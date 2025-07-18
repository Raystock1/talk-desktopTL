/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

const {
	contextBridge,
	ipcRenderer,
} = require('electron')

const { license, bugs, repository } = require('../package.json')

const packageInfo = {
	license,
	bugs,
	repository: repository.url,
}

/**
 * @global
 */
const TALK_DESKTOP = {
	process,
	/**
	 * Subset of package.json meta-data
	 *
	 * @type {typeof packageInfo} packageInfo
	 */
	packageInfo,
	/**
	 * Get the current window title
	 *
	 * @return {Promise<string>}
	 */
	getTitle: () => ipcRenderer.invoke('app:getTitle'),
	/**
	 * Quit the application
	 */
	quit: () => ipcRenderer.send('app:quit'),
	/**
	 * Get system information such as OS version or installation properties
	 *
	 * @return {Promise<import('./app/system.utils.ts').OsVersion>}
	 */
	getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),
	/**
	 * Get system locale and preferred language
	 *
	 * @return {Promise<{ locale: string, language: string }>}
	 */
	getSystemL10n: () => ipcRenderer.invoke('app:getSystemL10n'),
	/**
	 * Enable web request intercepting
	 *
	 * @type {typeof import('./app/webRequestInterceptor').enableWebRequestInterceptor}
	 */
	enableWebRequestInterceptor: (...args) => ipcRenderer.invoke('app:enableWebRequestInterceptor', ...args),
	/**
	 * Disable web request intercepting
	 *
	 * @type {typeof import('./app/webRequestInterceptor').disableWebRequestInterceptor}
	 */
	disableWebRequestInterceptor: (...args) => ipcRenderer.invoke('app:disableWebRequestInterceptor', ...args),
	/**
	 * Set or remove notifications badge
	 *
	 * @param {number} [count] - Count of notification or 0 to disable
	 * @return {Promise<void>}
	 */
	setBadgeCount: (count) => ipcRenderer.invoke('app:setBadgeCount', count),
	/**
	 * Start or stop flashing (on Windows) or bouncing (on Mac) of app icon
	 *
	 * @param {boolean} shouldFlash - True to enable, false to disable
	 */
	flashAppIcon: (shouldFlash) => ipcRenderer.send('talk:flashAppIcon', shouldFlash),
	/**
	 * Get available desktop capture sources: screens and windows
	 *
	 * @return {Promise<{ id: string, name: string, icon?: string }[]|null>}
	 */
	getDesktopCapturerSources: () => ipcRenderer.invoke('app:getDesktopCapturerSources'),
	/**
	 * Relaunch an entire application
	 */
	relaunch: () => ipcRenderer.send('app:relaunch'),
	/**
	 * Relaunch the main window without relaunching an entire application
	 */
	relaunchWindow: () => ipcRenderer.send('app:relaunchWindow'),
	/**
	 * Get an application config value by key
	 *
	 * @param {string} [key] - Config key
	 * @return {Promise<Record<string, unknown> | unknown>}
	 */
	getAppConfig: (key) => ipcRenderer.invoke('app:config:get', key),
	/**
	 * Set an application config value by key
	 *
	 * @param {string} key - Config key
	 * @param {any} [value] - Config value
	 * @return {Promise<void>}
	 */
	setAppConfig: (key, value) => ipcRenderer.invoke('app:config:set', key, value),
	/**
	 * Listen for changes in the application config
	 *
	 * @param {(event: import('electron').IpcRedererEvent, payload: { key: string, value: unknown, appConfig: import('./app/AppConfig.ts').AppConfig}) => void} callback - Callback
	 */
	onAppConfigChange: (callback) => ipcRenderer.on('app:config:change', callback),
	/**
	 * Trigger download of a URL
	 *
	 * @param {string} url - URL to download
	 * @param {string} [filename] - Filename suggestion for the download
	 */
	downloadURL: (url, filename) => ipcRenderer.send('app:downloadURL', url, filename),
	/**
	 * Open developer tools
	 */
	toggleDevTools: () => ipcRenderer.send('app:toggleDevTools'),
	/**
	 * Invoke app:anything
	 *
	 * @param {...any} args - Arguments
	 */
	invokeAnything: (...args) => ipcRenderer.invoke('app:anything', ...args),
	/**
	 * Open chrome://webrtc-internals
	 */
	openChromeWebRtcInternals: () => ipcRenderer.send('app:openChromeWebRtcInternals'),
	/**
	 * Send appData to main process on restore
	 *
	 * @param {object} appDataDto appData as plain object
	 */
	sendAppData: (appDataDto) => ipcRenderer.send('appData:receive', appDataDto),
	/**
	 * Open a web-view modal window with Nextcloud Server login page
	 *
	 * @param {string} server - Server URL
	 * @return {Promise<import('./accounts/login.service.js').Credentials|Error>}
	 */
	openLoginWebView: (server) => ipcRenderer.invoke('authentication:openLoginWebView', server),
	/**
	 * Open main window after logging in
	 *
	 * @return {Promise<void>}
	 */
	login: () => ipcRenderer.invoke('authentication:login'),
	/**
	 * Logout and open accounts window
	 *
	 * @return {Promise<void>}
	 */
	logout: () => ipcRenderer.invoke('authentication:logout'),
	/**
	 * Focus and restore the talk window
	 *
	 * @return {Promise<void>}
	 */
	focusTalk: () => ipcRenderer.invoke('talk:focus'),
	/**
	 * Show the callbox window
	 *
	 * @param {object} params - Callbox parameters
	 */
	showCallbox: (params) => ipcRenderer.send('callbox:show', params),
	/**
	 * Show the help window (aka About)
	 *
	 * @return {Promise<void>}
	 */
	showHelp: () => ipcRenderer.invoke('help:show'),
	/**
	 * Show the upgrade window
	 *
	 * @return {Promise<void>}
	 */
	showUpgrade: () => ipcRenderer.invoke('upgrade:show'),
}

// Set global window.TALK_DESKTOP
contextBridge.exposeInMainWorld('TALK_DESKTOP', {
  onNewChatMessage: (msg) => {
    ipcRenderer.send('newMessage', msg)
  },
  markMessagesAsRead: () => {
    ipcRenderer.send('clearMessages')
  }
})
})
