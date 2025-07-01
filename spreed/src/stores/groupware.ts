/**
 * SPDX-FileCopyrightText: 2023 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineStore } from 'pinia'
import Vue from 'vue'

import type { AxiosError } from '@nextcloud/axios'
import { generateUrl, getBaseUrl } from '@nextcloud/router'

import {
	initializeCalDavClient,
	getPersonalCalendars,
	getDefaultCalendarUri,
	convertUrlToUri,
} from '../services/CalDavClient.ts'
import {
	getUpcomingEvents,
	getUserAbsence,
	scheduleMeeting,
} from '../services/groupwareService.ts'
import type {
	DavCalendar,
	OutOfOfficeResult,
	UpcomingEvent,
	scheduleMeetingParams,
} from '../types/index.ts'

type State = {
	absence: Record<string, OutOfOfficeResult>
	calendars: Record<string, DavCalendar & { uri: string }>,
	defaultCalendarUri: string | null,
	upcomingEvents: Record<string, UpcomingEvent[]>
}

export const useGroupwareStore = defineStore('groupware', {
	state: (): State => ({
		absence: {},
		calendars: {},
		defaultCalendarUri: null,
		upcomingEvents: {},
	}),

	getters: {
		getAllEvents: (state) => (token: string) => {
			return state.upcomingEvents[token] ?? []
		},
		getNextEvent: (state) => (token: string) => {
			return state.upcomingEvents[token]?.[0]
		},
		writeableCalendars: (state) => {
			return Object.values(state.calendars).filter(calendar => {
				return calendar.isWriteable() && calendar.components.includes('VEVENT')
			})
		},
	},

	actions: {
		/**
		 * Fetch an absence status for user and save to store
		 * @param payload action payload
		 * @param payload.token The conversation token
		 * @param payload.userId The id of user
		 */
		async getUserAbsence({ token, userId } : { token: string, userId: string}) {
			try {
				const response = await getUserAbsence(userId)
				Vue.set(this.absence, token, response.data.ocs.data)
				return this.absence[token]
			} catch (error) {
				if ((error as AxiosError)?.response?.status === 404) {
					Vue.set(this.absence, token, null)
					return null
				}
				console.error(error)
			}
		},

		/**
		 * Fetch upcoming events for conversation and save to store
		 * @param token The conversation token
		 */
		async getUpcomingEvents(token: string) {
			const location = generateUrl('call/{token}', { token }, { baseURL: getBaseUrl() })
			try {
				const response = await getUpcomingEvents(location)
				Vue.set(this.upcomingEvents, token, response.data.ocs.data.events)
			} catch (error) {
				console.error(error)
			}
		},

		async getDefaultCalendarUri() {
			try {
				await initializeCalDavClient()
				Vue.set(this, 'defaultCalendarUri', getDefaultCalendarUri())
			} catch (error) {
				console.error(error)
			}
		},

		async getPersonalCalendars() {
			try {
				await initializeCalDavClient()
				const calendars = await getPersonalCalendars()
				calendars.forEach(calendar => {
					const calendarWithUri = Object.assign(calendar, { uri: convertUrlToUri(calendar.url) })
					Vue.set(this.calendars, calendarWithUri.uri, calendarWithUri)
				})
			} catch (error) {
				console.error(error)
			}
		},

		async scheduleMeeting(token: string, payload: scheduleMeetingParams) {
			await scheduleMeeting(token, payload)
			// Fetch updated list of events for this conversation
			await this.getUpcomingEvents(token)
		},

		/**
		 * Drop an absence status from the store
		 * @param token The conversation token
		 */
		removeUserAbsence(token: string) {
			if (this.absence[token]) {
				Vue.delete(this.absence, token)
			}
		},

		/**
		 * Drop upcoming events from the store
		 * @param token The conversation token
		 */
		removeUpcomingEvents(token: string) {
			if (this.upcomingEvents[token]) {
				Vue.delete(this.upcomingEvents, token)
			}
		},

		/**
		 * Clears store for a deleted conversation
		 * @param token The conversation token
		 */
		purgeGroupwareStore(token: string) {
			this.removeUserAbsence(token)
			this.removeUpcomingEvents(token)
		},
	},
})
