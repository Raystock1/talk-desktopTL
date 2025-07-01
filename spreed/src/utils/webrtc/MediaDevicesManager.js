/**
 * SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { t } from '@nextcloud/l10n'

import BrowserStorage from '../../services/BrowserStorage.js'
import {
  getFirstAvailableMediaDevice,
  listMediaDevices,
  populateMediaDevicesPreferences,
  promoteMediaDevice,
} from '../../services/mediaDevicePreferences.ts'
import EmitterMixin from '../EmitterMixin.js'

const LOCAL_STORAGE_NULL_DEVICE_ID = 'local-storage-null-device-id'

export default function MediaDevicesManager() {
  this._superEmitterMixin()

  this.attributes = {
    devices: [],
    audioInputId: undefined,
    videoInputId: undefined,
  }

  this._enabledCount = 0
  this._knownDevices = {}
  this._tracks = []
  this._updateDevicesBound = this._updateDevices.bind(this)
  this._pendingEnumerateDevicesPromise = null

  const audioInputPreferences = BrowserStorage.getItem('audioInputPreferences')
  this._preferenceAudioInputList = audioInputPreferences !== null ? JSON.parse(audioInputPreferences) : []

  const videoInputPreferences = BrowserStorage.getItem('videoInputPreferences')
  this._preferenceVideoInputList = videoInputPreferences !== null ? JSON.parse(videoInputPreferences) : []

  if (BrowserStorage.getItem('audioInputId') === LOCAL_STORAGE_NULL_DEVICE_ID) {
    this.attributes.audioInputId = null
  }
  if (BrowserStorage.getItem('videoInputId') === LOCAL_STORAGE_NULL_DEVICE_ID) {
    this.attributes.videoInputId = null
  }

  if (this.isSupported()) {
    this.requestInitialPermissions();
  }
}

MediaDevicesManager.prototype = {
  get(key) {
    return this.attributes[key]
  },

  set(key, value) {
    this.attributes[key] = value
    this._trigger('change:' + key, [value])
    this._storeDeviceId(key, value)
    console.debug('Storing device selection in the browser storage: ', key, value)
  },

  _storeDeviceId(key, value) {
    if (key !== 'audioInputId' && key !== 'videoInputId') {
      return
    }

    if (value === null) {
      value = LOCAL_STORAGE_NULL_DEVICE_ID
    }

    if (value) {
      BrowserStorage.setItem(key, value)
    } else {
      BrowserStorage.removeItem(key)
    }
  },

  isSupported() {
    return navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.enumerateDevices
  },

  requestInitialPermissions() {
    console.log('Requesting initial media permissions...');
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(stream => {
        console.log('Initial permissions granted, stopping stream...');
        stream.getTracks().forEach(track => track.stop());
        this._updateDevices();
      })
      .catch(err => {
        console.error('Initial permission request failed:', err.name, err.message);
        this._updateDevices();
      });
  },

  enableDeviceEvents() {
    if (!this.isSupported()) {
      return
    }

    this._enabledCount++
    this._updateDevices()
    navigator.mediaDevices.addEventListener('devicechange', this._updateDevicesBound)
  },

  disableDeviceEvents() {
    if (!this.isSupported()) {
      return
    }

    this._enabledCount--

    if (!this._enabledCount) {
      navigator.mediaDevices.removeEventListener('devicechange', this._updateDevicesBound)
    }
  },

  _updateDevices() {
    console.log('Updating devices...');
    this._pendingEnumerateDevicesPromise = navigator.mediaDevices.enumerateDevices().then(devices => {
      console.log('Devices enumerated:', devices);

      const previousAudioInputId = this.attributes.audioInputId;
      const previousVideoInputId = this.attributes.videoInputId;
      const previousFirstAvailableAudioInputId = getFirstAvailableMediaDevice(this.attributes.devices, this._preferenceAudioInputList);
      const previousFirstAvailableVideoInputId = getFirstAvailableMediaDevice(this.attributes.devices, this._preferenceVideoInputList);

      const removedDevices = this.attributes.devices.filter(oldDevice => !devices.find(device => oldDevice.deviceId === device.deviceId && oldDevice.kind === device.kind));
      const updatedDevices = devices.filter(device => this.attributes.devices.find(oldDevice => device.deviceId === oldDevice.deviceId && device.kind === oldDevice.kind));
      const addedDevices = devices.filter(device => !this.attributes.devices.find(oldDevice => device.deviceId === oldDevice.deviceId && device.kind === oldDevice.kind));

      removedDevices.forEach(removedDevice => {
        this._removeDevice(removedDevice);
      });
      updatedDevices.forEach(updatedDevice => {
        this._updateDevice(updatedDevice);
      });
      addedDevices.forEach(addedDevice => {
        this._addDevice(addedDevice);
      });

      this._populatePreferences(devices);

      let deviceIdChanged = false;
      if (this.attributes.audioInputId === undefined || this.attributes.audioInputId === previousFirstAvailableAudioInputId) {
        this.attributes.audioInputId = getFirstAvailableMediaDevice(devices, this._preferenceAudioInputList) || devices.find(device => device.kind === 'audioinput')?.deviceId;
        deviceIdChanged = true;
      }
      if (this.attributes.videoInputId === undefined || this.attributes.videoInputId === previousFirstAvailableVideoInputId) {
        this.attributes.videoInputId = getFirstAvailableMediaDevice(devices, this._preferenceVideoInputList) || devices.find(device => device.kind === 'videoinput')?.deviceId;
        deviceIdChanged = true;
      }

      if (deviceIdChanged) {
        console.debug(listMediaDevices(this.attributes, this._preferenceAudioInputList, this._preferenceVideoInputList));
      }

      if (previousAudioInputId !== this.attributes.audioInputId) {
        this._trigger('change:audioInputId', [this.attributes.audioInputId]);
      }
      if (previousVideoInputId !== this.attributes.videoInputId) {
        this._trigger('change:videoInputId', [this.attributes.videoInputId]);
      }

      this._pendingEnumerateDevicesPromise = null;
    }).catch(error => {
      console.error('Could not update known media devices:', error.name, error.message);
      this._pendingEnumerateDevicesPromise = null;
    });
  },

  _populatePreferences(devices) {
    const { newAudioInputList, newVideoInputList } = populateMediaDevicesPreferences(
      devices,
      this._preferenceAudioInputList,
      this._preferenceVideoInputList,
    );

    if (newAudioInputList) {
      this._preferenceAudioInputList = newAudioInputList;
      BrowserStorage.setItem('audioInputPreferences', JSON.stringify(this._preferenceAudioInputList));
    }
    if (newVideoInputList) {
      this._preferenceVideoInputList = newVideoInputList;
      BrowserStorage.setItem('videoInputPreferences', JSON.stringify(this._preferenceVideoInputList));
    }
  },

  updatePreferences(kind) {
    if (kind === 'audioinput') {
      const newAudioInputList = promoteMediaDevice({
        kind,
        devices: this.attributes.devices,
        inputList: this._preferenceAudioInputList,
        inputId: this.attributes.audioInputId
      });

      if (newAudioInputList) {
        this._preferenceAudioInputList = newAudioInputList;
        BrowserStorage.setItem('audioInputPreferences', JSON.stringify(newAudioInputList));
      }
      if (!BrowserStorage.getItem('audioInputDevicePreferred')) {
        BrowserStorage.setItem('audioInputDevicePreferred', true);
      }
    } else if (kind === 'videoinput') {
      const newVideoInputList = promoteMediaDevice({
        kind,
        devices: this.attributes.devices,
        inputList: this._preferenceVideoInputList,
        inputId: this.attributes.videoInputId
      });

      if (newVideoInputList) {
        this._preferenceVideoInputList = newVideoInputList;
        BrowserStorage.setItem('videoInputPreferences', JSON.stringify(newVideoInputList));
      }
      if (!BrowserStorage.getItem('videoInputDevicePreferred')) {
        BrowserStorage.setItem('videoInputDevicePreferred', true);
      }
    }
  },

  listDevices() {
    if (this.attributes.devices.length) {
      console.info(listMediaDevices(this.attributes, this._preferenceAudioInputList, this._preferenceVideoInputList));
    } else {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        console.info(listMediaDevices(
          { devices, audioInputId: this.attributes.audioInputId, videoInputId: this.attributes.videoInputId },
          this._preferenceAudioInputList,
          this._preferenceVideoInputList,
        ));
      });
    }
  },

  _removeDevice(removedDevice) {
    const removedDeviceIndex = this.attributes.devices.findIndex(oldDevice => oldDevice.deviceId === removedDevice.deviceId && oldDevice.kind === removedDevice.kind);
    if (removedDeviceIndex >= 0) {
      this.attributes.devices.splice(removedDeviceIndex, 1);
    }
    if (removedDevice.kind === 'audioinput' && removedDevice.deviceId === this.attributes.audioInputId) {
      this.attributes.audioInputId = undefined;
    } else if (removedDevice.kind === 'videoinput' && removedDevice.deviceId === this.attributes.videoInputId) {
      this.attributes.videoInputId = undefined;
    }
  },

  _updateDevice(updatedDevice) {
    const oldDevice = this.attributes.devices.find(oldDevice => oldDevice.deviceId === updatedDevice.deviceId && oldDevice.kind === updatedDevice.kind);

    if (updatedDevice.label) {
      oldDevice.label = updatedDevice.label;
    }

    oldDevice.groupId = updatedDevice.groupId;
    oldDevice.kind = updatedDevice.kind;
  },

  _addDevice(addedDevice) {
    addedDevice = {
      deviceId: addedDevice.deviceId,
      groupId: addedDevice.groupId,
      kind: addedDevice.kind,
      label: addedDevice.label,
    };

    const knownDevice = this._knownDevices[addedDevice.kind + '-' + addedDevice.deviceId];
    if (knownDevice) {
      addedDevice.fallbackLabel = knownDevice.fallbackLabel;
      addedDevice.label = addedDevice.label ? addedDevice.label : knownDevice.label;
    } else {
      if (addedDevice.deviceId === 'default' || addedDevice.deviceId === '') {
        addedDevice.fallbackLabel = t('spreed', 'Default');
      } else if (addedDevice.kind === 'audioinput') {
        addedDevice.fallbackLabel = t('spreed', 'Microphone {number}', { number: Object.values(this._knownDevices).filter(device => device.kind === 'audioinput' && device.deviceId !== '').length + 1 });
      } else if (addedDevice.kind === 'videoinput') {
        addedDevice.fallbackLabel = t('spreed', 'Camera {number}', { number: Object.values(this._knownDevices).filter(device => device.kind === 'videoinput' && device.deviceId !== '').length + 1 });
      } else if (addedDevice.kind === 'audiooutput') {
        addedDevice.fallbackLabel = t('spreed', 'Speaker {number}', { number: Object.values(this._knownDevices).filter(device => device.kind === 'audiooutput' && device.deviceId !== '').length + 1 });
      }
    }

    this._knownDevices[addedDevice.kind + '-' + addedDevice.deviceId] = addedDevice;
    this.attributes.devices.push(addedDevice);
  },

  getUserMedia(constraints) {
    if (!this.isSupported()) {
      return new Promise((resolve, reject) => {
        reject(new DOMException('MediaDevicesManager is not supported', 'NotSupportedError'));
      });
    }

    console.log('Calling getUserMedia with constraints:', constraints);

    if (!this._pendingEnumerateDevicesPromise) {
      return this._getUserMediaInternal(constraints);
    }

    return this._pendingEnumerateDevicesPromise.then(() => {
      return this._getUserMediaInternal(constraints);
    }).catch(() => {
      return this._getUserMediaInternal(constraints);
    });
  },

  _getUserMediaInternal(constraints) {
    if (constraints.audio && !constraints.audio.deviceId) {
      if (this.attributes.audioInputId) {
        if (!(constraints.audio instanceof Object)) {
          constraints.audio = {};
        }
        constraints.audio.deviceId = { exact: this.attributes.audioInputId };
      } else if (this.attributes.audioInputId === null) {
        constraints.audio = false;
      }
    }

    if (constraints.video && !constraints.video.deviceId) {
      if (this.attributes.videoInputId) {
        if (!(constraints.video instanceof Object)) {
          constraints.video = {};
        }
        constraints.video.deviceId = { exact: this.attributes.videoInputId };
      } else if (this.attributes.videoInputId === null) {
        constraints.video = false;
      }
    }

    console.log('Final constraints for getUserMedia:', constraints);

    this._stopIncompatibleTracks(constraints);

    return navigator.mediaDevices.getUserMedia(constraints).then(stream => {
      console.log('getUserMedia success, stream:', stream);
      this._registerStream(stream);

      this._updateSelectedDevicesFromGetUserMediaResult(stream);
      this._updateDevices();

      return stream;
    }).catch(error => {
      console.error('getUserMedia failed:', error.name, error.message, error.stack);
      this._updateDevices();
      throw error;
    });
  },

  _stopIncompatibleTracks(constraints) {
    this._tracks.forEach(track => {
      if (constraints.audio && constraints.audio.deviceId && track.kind === 'audio') {
        const constraintsAudioDeviceId = constraints.audio.deviceId.exact || constraints.audio.deviceId.ideal || constraints.audio.deviceId;
        const settings = track.getSettings();
        if (settings && settings.deviceId !== constraintsAudioDeviceId) {
          track.stop();
        }
      }

      if (constraints.video && constraints.video.deviceId && track.kind === 'video') {
        const constraintsVideoDeviceId = constraints.video.deviceId.exact || constraints.video.deviceId.ideal || constraints.video.deviceId;
        const settings = track.getSettings();
        if (settings && settings.deviceId !== constraintsVideoDeviceId) {
          track.stop();
        }
      }
    });
  },

  _registerStream(stream) {
    stream.getTracks().forEach(track => {
      this._registerTrack(track);
    });
  },

  _registerTrack(track) {
    this._tracks.push(track);

    track.addEventListener('ended', () => {
      const index = this._tracks.indexOf(track);
      if (index >= 0) {
        this._tracks.splice(index, 1);
      }
    });

    track.addEventListener('cloned', event => {
      this._registerTrack(event.detail);
    });
  },

  _updateSelectedDevicesFromGetUserMediaResult(stream) {
    if (this.attributes.audioInputId) {
      const audioTracks = stream.getAudioTracks();
      const audioTrackSettings = audioTracks.length > 0 ? audioTracks[0].getSettings() : null;
      if (audioTrackSettings && audioTrackSettings.deviceId && this.attributes.audioInputId !== audioTrackSettings.deviceId) {
        console.debug('Input audio device overridden in getUserMedia: Expected: ' + this.attributes.audioInputId + ' Found: ' + audioTrackSettings.deviceId);
        this.set('audioInputId', audioTrackSettings.deviceId);
      }
    }

    if (this.attributes.videoInputId) {
      const videoTracks = stream.getVideoTracks();
      const videoTrackSettings = videoTracks.length > 0 ? videoTracks[0].getSettings() : null;
      if (videoTrackSettings && videoTrackSettings.deviceId && this.attributes.videoInputId !== videoTrackSettings.deviceId) {
        console.debug('Input video device overridden in getUserMedia: Expected: ' + this.attributes.videoInputId + ' Found: ' + videoTrackSettings.deviceId);
        this.set('videoInputId', videoTrackSettings.deviceId);
      }
    }
  },
};

EmitterMixin.apply(MediaDevicesManager.prototype);