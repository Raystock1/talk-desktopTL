<!--
  - SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcAppNavigation ref="leftSidebar" :aria-label="t('spreed', 'Conversation list')">
		<template #search="">
			<div class="new-conversation">
				<TransitionWrapper name="radial-reveal">
					<NcButton v-show="searchText === ''"
						type="tertiary"
						:class="{ 'hidden-visually': isSearching }"
						class="talk-home-button"
						:title="t('spreed', 'Talk home')"
						:aria-label="t('spreed', 'Talk home')"
						@click="showTalkDashboard">
						<template #icon="">
							<IconHome :size="20" />
						</template>
					</NcButton>
				</TransitionWrapper>
				<div class="conversations-search"
					:class="{ 'conversations-search--expanded': isSearching }">
					<SearchBox ref="searchBox"
						:value.sync="searchText"
						:is-focused.sync="isFocused"
						:list-ref="[scroller, searchResults]"
						@input="debounceFetchSearchResults"
						@abort-search="abortSearch" />
				</div>

				<TransitionWrapper name="radial-reveal">
					<!-- Filters -->
					<NcActions v-show="searchText === ''"
						:type="isFiltered ? 'secondary' : 'tertiary'"
						class="filters"
						:class="{ 'hidden-visually': isSearching }">
						<template #icon="">
							<FilterIcon :size="15" />
						</template>
						<NcActionCaption :name="t('spreed', 'Filter conversations by')" />

						<NcActionButton close-after-click=""
							type="checkbox"
							:model-value="filters.includes('mentions')"
							@click="handleFilter('mentions')">
							<template #icon="">
								<AtIcon :size="20" />
							</template>
							{{ t('spreed', 'Unread mentions') }}
						</NcActionButton>

						<NcActionButton close-after-click=""
							type="checkbox"
							:model-value="filters.includes('unread')"
							@click="handleFilter('unread')">
							<template #icon="">
								<MessageBadge :size="20" />
							</template>
							{{ t('spreed', 'Unread messages') }}
						</NcActionButton>

						<NcActionButton close-after-click=""
							type="checkbox"
							:model-value="filters.includes('events')"
							@click="handleFilter('events')">
							<template #icon="">
								<IconCalendar :size="20" />
							</template>
							{{ t('spreed', 'Meeting conversations') }}
						</NcActionButton>

						<NcActionButton v-if="isFiltered"
							close-after-click=""
							class="filter-actions__clearbutton"
							@click="handleFilter(null)">
							<template #icon="">
								<FilterRemoveIcon :size="20" />
							</template>
							{{ t('spreed', 'Clear filters') }}
						</NcActionButton>
					</NcActions>
				</TransitionWrapper>

				<!-- Actions -->
				<TransitionWrapper name="radial-reveal">
					<NcActions v-show="searchText === ''"
						class="actions"
						:class="{ 'hidden-visually': isSearching }">
						<template #icon="">
							<ChatPlus :size="20" />
						</template>
						<NcActionButton v-if="canStartConversations"
							close-after-click=""
							@click="showModalNewConversation">
							<template #icon="">
								<Plus :size="20" />
							</template>
							{{ t('spreed', 'Create a new conversation') }}
						</NcActionButton>

						<NcActionButton v-if="canNoteToSelf && !hasNoteToSelf"
							close-after-click=""
							@click="restoreNoteToSelfConversation">
							<template #icon="">
								<Note :size="20" />
							</template>
							{{ t('spreed', 'New personal note') }}
						</NcActionButton>

						<NcActionButton close-after-click=""
							@click="showModalListConversations">
							<template #icon="">
								<List :size="20" />
							</template>
							{{ t('spreed', 'Join open conversations') }}
						</NcActionButton>

						<NcActionButton v-if="canModerateSipDialOut"
							close-after-click=""
							@click="showModalCallPhoneDialog">
							<template #icon="">
								<Phone :size="20" />
							</template>
							{{ t('spreed', 'Call a phone number') }}
						</NcActionButton>
					</NcActions>
				</TransitionWrapper>

				<!-- All open conversations list -->
				<OpenConversationsList ref="openConversationsList" />

				<!-- New Conversation dialog -->
				<NewConversationDialog ref="newConversationDialog" :can-moderate-sip-dial-out="canModerateSipDialOut" />

				<!-- New phone (SIP dial-out) dialog -->
				<CallPhoneDialog v-if="canModerateSipDialOut" ref="callPhoneDialog" />

				<!-- New Pending Invitations dialog -->
				<InvitationHandler v-if="pendingInvitationsCount" ref="invitationHandler" />
			</div>
			<!-- Tabs for switching conversations type -->
			<div class="sidebar-tabs">
				<NcButton
				  :class="{ 'is-active': selectedTab === 'personal' }"
				  @click="selectedTab = 'personal'"
				  type="tertiary"
				  size="small"
				  style="border: 2px solid rgba(0, 155, 122, 0.15)"
  >
					Личные
				</NcButton>
				<NcButton
				  :class="{ 'is-active': selectedTab === 'groups' }"
				  @click="selectedTab = 'groups'"
				  type="tertiary"
				  size="small"
				  style="border: 2px solid rgba(0, 155, 122, 0.15)"
  >
					Группы
				</NcButton>
			</div>

			<TransitionWrapper class="conversations__filters"
				name="zoom"
				tag="div"
				group="">
				<NcChip v-for="filter in filters"
					:key="filter"
					:text="FILTER_LABELS[filter]"
					@close="handleFilter(filter)" />
			</TransitionWrapper>
			<NcAppNavigationItem v-if="pendingInvitationsCount"
				class="invitation-button"
				:name="t('spreed', 'Pending invitations')"
				@click="showInvitationHandler">
				<template #icon="">
					<AccountMultiplePlus :size="20" />
				</template>
				<template #counter="">
					<NcCounterBubble type="highlighted" :count="pendingInvitationsCount" />
				</template>
			</NcAppNavigationItem>
		</template>

		<template #list="">
			<!-- Conversations List -->
			<template v-if="!isSearching">
				<NcEmptyContent v-if="conversationsInitialised && filteredConversationsList.length === 0"
					:name="emptyContentLabel"
					:description="emptyContentDescription">
					<template #icon="">
						<AtIcon v-if="filters.length === 1 && filters[0] === 'mentions'" :size="64" />
						<MessageBadge v-else-if="filters.length === 1 && filters[0] === 'unread'" :size="64" />
						<IconArchive v-else-if="showArchived" :size="64" />
						<MessageOutline v-else="" :size="64" />
					</template>
					<template #action="">
						<NcButton v-if="isFiltered" @click="handleFilter(null)">
							<template #icon="">
								<FilterRemoveIcon :size="20" />
							</template>
							{{ t('spreed', 'Clear filter') }}
						</NcButton>
					</template>
				</NcEmptyContent>
				<ConversationsListVirtual v-show="filteredConversationsList.length > 0"
					ref="scroller"
				:conversations="filteredConversationsByTab"
				:loading="!conversationsInitialised"
					:compact="isCompact"
					class="scroller"
					@scroll.native="debounceHandleScroll" />
				<NcButton v-if="!preventFindingUnread && lastUnreadMentionBelowViewportIndex !== null"
					class="unread-mention-button"
					type="primary"
					@click="scrollBottomUnread">
					{{ t('spreed', 'Unread mentions') }}
				</NcButton>
			</template>

			<!-- Search results -->
			<SearchConversationsResults v-else=""
				ref="searchResults"
				class="scroller"
				:search-text="searchText"
				:contacts-loading="contactsLoading"
				:conversations-list="conversationsList"
				:search-results="searchResults"
				:search-results-listed-conversations="searchResultsListedConversations"
				@abort-search="abortSearch"
				@create-new-conversation="createConversation"
				@create-and-join-conversation="createAndJoinConversation" />
		</template>

		<template #footer="">
			<div class="left-sidebar__settings-button-container">
				<template v-if="!isSearching && supportsArchive">
					<NcButton v-if="showArchived"
						type="tertiary"
						wide=""
						@click="showArchived = false">
						<template #icon="">
							<IconArrowLeft class="bidirectional-icon" :size="20" />
						</template>
						{{ t('spreed', 'Back to conversations') }}
					</NcButton>
					<NcButton v-else-if="archivedConversationsList.length"
						type="tertiary"
						wide=""
						@click="showArchived = true">
						<template #icon="">
							<IconArchive :size="20" />
						</template>
						{{ t('spreed', 'Archived conversations') }}
						<span v-if="showArchivedConversationsBubble" class="left-sidebar__settings-button-bubble">
							⬤
						</span>
					</NcButton>
				</template>

				<NcButton type="tertiary" wide="" @click="showSettings">
					<template #icon="">
						<Cog :size="20" />
					</template>
					{{ t('spreed', 'Talk settings') }}
				</NcButton>
			</div>
		</template>
	</NcAppNavigation>
</template>

<script>
	import { showError } from '@nextcloud/dialogs'
	import { emit } from '@nextcloud/event-bus'
	import { loadState } from '@nextcloud/initial-state'
	import { t } from '@nextcloud/l10n'
	import { useIsMobile } from '@nextcloud/vue/composables/useIsMobile'
	import debounce from 'debounce'
	import { ref } from 'vue'
	import NcActionButton from '@nextcloud/vue/components/NcActionButton'
	import NcActionCaption from '@nextcloud/vue/components/NcActionCaption'
	import NcActions from '@nextcloud/vue/components/NcActions'
	import NcAppNavigation from '@nextcloud/vue/components/NcAppNavigation'
	import NcAppNavigationItem from '@nextcloud/vue/components/NcAppNavigationItem'
	import NcButton from '@nextcloud/vue/components/NcButton'
	import NcChip from '@nextcloud/vue/components/NcChip'
	import NcCounterBubble from '@nextcloud/vue/components/NcCounterBubble'
	import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
	import AccountMultiplePlus from 'vue-material-design-icons/AccountMultiplePlus.vue'
	import IconArchive from 'vue-material-design-icons/Archive.vue'
	import IconArrowLeft from 'vue-material-design-icons/ArrowLeft.vue'
	import AtIcon from 'vue-material-design-icons/At.vue'
	import IconCalendar from 'vue-material-design-icons/CalendarBlank.vue'
	import ChatPlus from 'vue-material-design-icons/ChatPlus.vue'
	import Cog from 'vue-material-design-icons/Cog.vue'
	import FilterIcon from 'vue-material-design-icons/Filter.vue'
	import FilterRemoveIcon from 'vue-material-design-icons/FilterRemove.vue'
	import List from 'vue-material-design-icons/FormatListBulleted.vue'
	import IconHome from 'vue-material-design-icons/Home.vue'
	import MessageBadge from 'vue-material-design-icons/MessageBadge.vue'
	import MessageOutline from 'vue-material-design-icons/MessageOutline.vue'
	import Note from 'vue-material-design-icons/NoteEditOutline.vue'
	import Phone from 'vue-material-design-icons/Phone.vue'
	import Plus from 'vue-material-design-icons/Plus.vue'
	import NewConversationDialog from '../NewConversationDialog/NewConversationDialog.vue'
	import SearchBox from '../UIShared/SearchBox.vue'
	import TransitionWrapper from '../UIShared/TransitionWrapper.vue'
	import CallPhoneDialog from './CallPhoneDialog/CallPhoneDialog.vue'
	import ConversationsListVirtual from './ConversationsList/ConversationsListVirtual.vue'
	import InvitationHandler from './InvitationHandler.vue'
	import OpenConversationsList from './OpenConversationsList/OpenConversationsList.vue'
	import SearchConversationsResults from './SearchConversationsResults/SearchConversationsResults.vue'
	import { useArrowNavigation } from '../../composables/useArrowNavigation.js'
	import { ATTENDEE, CONVERSATION } from '../../constants.ts'
	import BrowserStorage from '../../services/BrowserStorage.js'
	import { getTalkConfig, hasTalkFeature } from '../../services/CapabilitiesManager.ts'
	import {
	createLegacyConversation,
	fetchNoteToSelfConversation,
	searchListedConversations,
	} from '../../services/conversationsService.ts'
	import { autocompleteQuery } from '../../services/coreService.ts'
	import { EventBus } from '../../services/EventBus.ts'
	import { talkBroadcastChannel } from '../../services/talkBroadcastChannel.js'
	import { useFederationStore } from '../../stores/federation.ts'
	import { useSettingsStore } from '../../stores/settings.js'
	import { useTalkHashStore } from '../../stores/talkHash.js'
	import CancelableRequest from '../../utils/cancelableRequest.js'
	import { filterConversation, hasCall, hasUnreadMentions, shouldIncludeArchived } from '../../utils/conversation.ts'
	import { requestTabLeadership } from '../../utils/requestTabLeadership.js'

	const isFederationEnabled = getTalkConfig('local', 'federation', 'enabled')
	const canModerateSipDialOut = hasTalkFeature('local', 'sip-support-dialout')
	&& getTalkConfig('local', 'call', 'sip-enabled')
	&& getTalkConfig('local', 'call', 'sip-dialout-enabled')
	&& getTalkConfig('local', 'call', 'can-enable-sip')
	const canNoteToSelf = hasTalkFeature('local', 'note-to-self')
	const supportsArchive = hasTalkFeature('local', 'archived-conversations-v2')
	const FILTER_LABELS = {
	unread: t('spreed', 'Unread'),
	mentions: t('spreed', 'Mentions'),
	events: t('spreed', 'Meetings'),
	default: '',
	}

	export default {
	name: 'LeftSidebar',

	components: {
	CallPhoneDialog,
	InvitationHandler,
	NcAppNavigation,
	NcAppNavigationItem,
	NcButton,
	NcCounterBubble,
	NcChip,
	SearchBox,
	NewConversationDialog,
	OpenConversationsList,
	NcActions,
	NcActionButton,
	NcActionCaption,
	TransitionWrapper,
	ConversationsListVirtual,
	SearchConversationsResults,
	// Icons
	AccountMultiplePlus,
	AtIcon,
	MessageBadge,
	MessageOutline,
	FilterIcon,
	FilterRemoveIcon,
	IconArchive,
	IconArrowLeft,
	IconCalendar,
	IconHome,
	Phone,
	Plus,
	ChatPlus,
	Cog,
	List,
	Note,
	NcEmptyContent,
	},

	setup() {
	const leftSidebar = ref(null)
	const searchBox = ref(null)
	const scroller = ref(null)

	const showArchived = ref(false)
	const filters = ref(BrowserStorage.getItem('filterEnabled')?.split(',') ?? [])

	const federationStore = useFederationStore()
	const talkHashStore = useTalkHashStore()
	const settingsStore = useSettingsStore()
	const { initializeNavigation, resetNavigation } = useArrowNavigation(leftSidebar, searchBox)
	const isMobile = useIsMobile()

	return {
	initializeNavigation,
	resetNavigation,
	leftSidebar,
	filters,
	searchBox,
	scroller,
	federationStore,
	talkHashStore,
	isMobile,
	canModerateSipDialOut,
	canNoteToSelf,
	supportsArchive,
	showArchived,
	settingsStore,
	FILTER_LABELS,
	}
	},

	data() {
	return {
	searchText: '',
	selectedTab: 'personal',
	searchResults: [],
	searchResultsListedConversations: [],
	contactsLoading: false,
	listedConversationsLoading: false,
	canStartConversations: getTalkConfig('local', 'conversations', 'can-create'),
	cancelSearchPossibleConversations: () => {},
	cancelSearchListedConversations: () => {},
	debounceFetchSearchResults: () => {},
	debounceFetchConversations: () => {},
	debounceHandleScroll: () => {},
	refreshTimer: null,
	/**
	* @type {number|null}
	*/
	lastUnreadMentionBelowViewportIndex: null,
	preventFindingUnread: false,
	roomListModifiedBefore: 0,
	forceFullRoomListRefreshAfterXLoops: 0,
	isFetchingConversations: false,
	isCurrentTabLeader: false,
	isFocused: false,
	isNavigating: false,
	}
	},

	computed: {
	filteredConversationsByTab() {
	if (this.selectedTab === 'personal') {
	// Личные чаты: нет description
	return this.filteredConversationsList.filter(
	c => !c.description && c.displayName
	)
	} else if (this.selectedTab === 'groups') {
	// Группы: description заполнено
	return this.filteredConversationsList.filter(
	c => !!c.description && c.displayName
	)
	}
	return this.filteredConversationsList
	},

	conversationsList() {
	return this.$store.getters.conversationsList
	},

	token() {
	return this.$store.getters.getToken()
	},

	emptyContentLabel() {
	if (this.isFiltered) {
	return t('spreed', 'No matches found')
	} else {
	return t('spreed', 'No conversations found')
	}
	},

	emptyContentDescription() {
	if (this.showArchived) {
	return t('spreed', 'You have no archived conversations.')
	}
	if (this.filters.length === 1 && this.filters[0] === 'mentions') {
	return t('spreed', 'You have no unread mentions.')
	} else if (this.filters.length === 1 && this.filters[0] === 'unread') {
	return t('spreed', 'You have no unread messages.')
	} else {
	return ''
	}
	},

	archivedConversationsList() {
	return this.$store.getters.archivedConversationsList
	},

	showArchivedConversationsBubble() {
	return this.archivedConversationsList
	.some((conversation) => hasUnreadMentions(conversation) || hasCall(conversation))
	},

	filteredConversationsList() {
	if (this.isFocused) {
	return this.conversationsList.filter((conversation) => shouldIncludeArchived(conversation, this.showArchived))
	}

	let validConversationsCount = 0
	const filteredConversations = this.conversationsList.filter((conversation) => {
	const conversationIsValid = filterConversation(conversation, this.filters)
	if (conversationIsValid) {
	validConversationsCount++
	}
	return shouldIncludeArchived(conversation, this.showArchived)
	&& (conversationIsValid || hasCall(conversation) || conversation.token === this.token)
	})
	// return empty if it only includes the current conversation without any flags
	return validConversationsCount === 0 && !this.isNavigating ? [] : filteredConversations
	},

	isSearching() {
	return this.searchText !== ''
	},

	hasNoteToSelf() {
	return this.conversationsList.find((conversation) => conversation.type === CONVERSATION.TYPE.NOTE_TO_SELF)
	},

	pendingInvitationsCount() {
	return isFederationEnabled
	? this.federationStore.pendingSharesCount
	: 0
	},

	isCompact() {
	return this.settingsStore.conversationsListStyle === CONVERSATION.LIST_STYLE.COMPACT
	},

	isFiltered() {
	return this.filters.length !== 0
	},

	conversationsInitialised() {
	return this.$store.getters.conversationsInitialised
	},
	},

	watch: {
	token(value) {
	if (value && this.isFiltered) {
	this.isNavigating = true
	}
	},

	isCompact(value) {
	if (!value) {
	// Last messages are likely missing from the store, need to fetch with modifiedSince=0
	this.roomListModifiedBefore = 0
	this.forceFullRoomListRefreshAfterXLoops = 10
	this.fetchConversations()
	}
	},
	},

	beforeMount() {
	// Restore last fetched conversations from browser storage,
	// before updated ones come from server
	this.restoreConversations()

	requestTabLeadership().then(() => {
	this.isCurrentTabLeader = true
	this.fetchConversations()
	// Refreshes the conversations list every 30 seconds
	this.refreshTimer = window.setInterval(() => {
	this.fetchConversations()
	}, 30000)
	})

	talkBroadcastChannel.addEventListener('message', (event) => {
	if (this.isCurrentTabLeader) {
	switch (event.data.message) {
	case 'force-fetch-all-conversations':
	if (event.data.options?.all) {
	this.roomListModifiedBefore = 0
	this.forceFullRoomListRefreshAfterXLoops = 10
	}
	this.debounceFetchConversations()
	break
	}
	} else {
	switch (event.data.message) {
	case 'update-conversations':
	this.$store.dispatch('patchConversations', {
	conversations: event.data.conversations,
	withRemoving: event.data.withRemoving,
	})
	this.federationStore.updatePendingSharesCount(event.data.invites)
	break
	case 'update-nextcloud-talk-hash':
	this.talkHashStore.setNextcloudTalkHash(event.data.hash)
	break
	}
	}
	})
	},

	mounted() {
	this.debounceFetchSearchResults = debounce(this.fetchSearchResults, 250)
	this.debounceFetchConversations = debounce(this.fetchConversations, 3000)
	this.debounceHandleScroll = debounce(this.handleScroll, 50)

	EventBus.on('should-refresh-conversations', this.handleShouldRefreshConversations)
	EventBus.once('conversations-received', this.handleConversationsReceived)
	EventBus.on('route-change', this.onRouteChange)
	EventBus.on('new-conversation-dialog:show', this.showModalNewConversation)
	EventBus.on('open-conversations-list:show', this.showModalListConversations)
	EventBus.on('call-phone-dialog:show', this.showModalCallPhoneDialog)
	},

	beforeDestroy() {
	this.debounceFetchSearchResults.clear?.()
	this.debounceFetchConversations.clear?.()
	this.debounceHandleScroll.clear?.()

	EventBus.off('should-refresh-conversations', this.handleShouldRefreshConversations)
	EventBus.off('conversations-received', this.handleConversationsReceived)
	EventBus.off('route-change', this.onRouteChange)
	EventBus.off('new-conversation-dialog:show', this.showModalNewConversation)
	EventBus.off('open-conversations-list:show', this.showModalListConversations)
	EventBus.off('call-phone-dialog:show', this.showModalCallPhoneDialog)

	this.cancelSearchPossibleConversations()
	this.cancelSearchPossibleConversations = null

	this.cancelSearchListedConversations()
	this.cancelSearchListedConversations = null

	if (this.refreshTimer) {
	clearInterval(this.refreshTimer)
	this.refreshTimer = null
	}
	},

	methods: {
	t,
	showModalNewConversation() {
	this.$refs.newConversationDialog.showModal()
	},

	showModalListConversations() {
	this.$refs.openConversationsList.showModal()
	},

	showModalCallPhoneDialog() {
	this.$refs.callPhoneDialog.showModal()
	},

	showInvitationHandler() {
	this.$refs.invitationHandler.showModal()
	},

	handleFilter(filter) {
	// Store the active filter
	if (filter === null) {
	this.filters = []
	} else {
	if (this.filters.includes(filter)) {
	this.filters = this.filters.filter((f) => f !== filter)
	} else {
	// Hardcode 'unread' and 'mentions' to behave like radio buttons
	if (filter === 'unread' || filter === 'mentions') {
	this.filters = [...this.filters.filter((f) => f !== 'unread' && f !== 'mentions'), filter]
	} else {
	this.filters = [...this.filters, filter]
	}
	}
	}

	if (this.filters.length) {
	BrowserStorage.setItem('filterEnabled', this.filters)
	} else {
	BrowserStorage.removeItem('filterEnabled')
	}

	// Clear the search input once a filter is active
	this.searchText = ''
	// Initiate the navigation status
	this.isNavigating = false
	},

	scrollBottomUnread() {
	this.preventFindingUnread = true
	this.$refs.scroller.scrollToItem(this.lastUnreadMentionBelowViewportIndex)
	setTimeout(() => {
	this.handleUnreadMention()
	this.preventFindingUnread = false
	}, 500)
	},

	async fetchPossibleConversations() {
	this.contactsLoading = true

	try {
	// FIXME: move to conversationsStore
	this.cancelSearchPossibleConversations('canceled')
	const { request, cancel } = CancelableRequest(autocompleteQuery)
	this.cancelSearchPossibleConversations = cancel

	const response = await request({
	searchText: this.searchText,
	token: 'new',
	onlyUsers: !this.canStartConversations,
	})

	const oneToOneMap = this.conversationsList.reduce((acc, result) => {
	if (result.type === CONVERSATION.TYPE.ONE_TO_ONE) {
	acc.push(result.name)
	}
	return acc
	}, [this.$store.getters.getUserId()])

	this.searchResults = response?.data?.ocs?.data.filter((match) => {
	return !(match.source === ATTENDEE.ACTOR_TYPE.USERS && oneToOneMap.includes(match.id))
	}) ?? []

	this.contactsLoading = false
	} catch (exception) {
	if (CancelableRequest.isCancel(exception)) {
	return
	}
	console.error('Error searching for possible conversations', exception)
	showError(t('spreed', 'An error occurred while performing the search'))
	}
	},

	async fetchListedConversations() {
	try {
	this.listedConversationsLoading = true

	// FIXME: move to conversationsStore
	this.cancelSearchListedConversations('canceled')
	const { request, cancel } = CancelableRequest(searchListedConversations)
	this.cancelSearchListedConversations = cancel

	const response = await request(this.searchText)
	this.searchResultsListedConversations = response.data.ocs.data
	this.listedConversationsLoading = false
	} catch (exception) {
	if (CancelableRequest.isCancel(exception)) {
	return
	}
	console.error('Error searching for open conversations', exception)
	showError(t('spreed', 'An error occurred while performing the search'))
	}
	},

	async fetchSearchResults() {
	if (!this.isSearching) {
	return
	}
	this.resetNavigation()
	await Promise.all([this.fetchPossibleConversations(), this.fetchListedConversations()])
	this.initializeNavigation()
	},

	/**
	* Create a new conversation with the selected user
	* or bring up the dialog to create a new group/circle conversation
	*
	* @param {object} item The autocomplete suggestion to start a conversation with
	* @param {string} item.id The ID of the target
	* @param {string} item.label The displayname of the target
	* @param {string} item.source The source of the target (e.g. users, groups, circle)
	*/
	async createAndJoinConversation(item) {
	if (item.source === ATTENDEE.ACTOR_TYPE.USERS) {
	// Create one-to-one conversation directly
	const conversation = await this.$store.dispatch('createOneToOneConversation', item.id)
	this.abortSearch()
	this.$router.push({
	name: 'conversation',
	params: { token: conversation.token },
	}).catch((err) => console.debug(`Error while pushing the new conversation's route: ${err}`))
	} else {
	// For other types, show the modal directly
	this.$refs.newConversationDialog.showModalForItem(item)
	}
	},

	switchToConversation(conversation) {
	this.$store.dispatch('addConversation', conversation)
	this.abortSearch()
	this.$router.push({
	name: 'conversation',
	params: { token: conversation.token },
	}).catch((err) => console.debug(`Error while pushing the new conversation's route: ${err}`))
	},

	async createConversation(roomName) {
	try {
	const response = await createLegacyConversation({
	roomType: CONVERSATION.TYPE.GROUP,
	roomName,
	})
	const conversation = response.data.ocs.data
	this.switchToConversation(conversation)
	} catch (error) {
	console.error('Error creating new private conversation: ', error)
	}
	},

	async restoreNoteToSelfConversation() {
	const response = await fetchNoteToSelfConversation()
	const conversation = response.data.ocs.data
	this.switchToConversation(conversation)
	},

	// Reset the search text, therefore end the search operation.
	abortSearch() {
	this.searchText = ''
	this.isFocused = false
	if (this.cancelSearchPossibleConversations) {
	this.cancelSearchPossibleConversations()
	}
	if (this.cancelSearchListedConversations) {
	this.cancelSearchListedConversations()
	}
	},

	showSettings() {
	// FIXME: use local EventBus service instead of the global one
	emit('show-settings')
	},

	/**
	* @param {object} [options] Options for conversation refreshing
	* @param {string} [options.token] The conversation token that got update
	* @param {object} [options.properties] List of changed properties
	* @param {boolean} [options.all] Whether all conversations should be fetched
	*/
	async handleShouldRefreshConversations(options) {
	if (options?.token && options?.properties) {
	await this.$store.dispatch('setConversationProperties', {
	token: options.token,
	properties: options.properties,
	})
	}

	if (this.isCurrentTabLeader) {
	if (options?.all === true) {
	this.roomListModifiedBefore = 0
	this.forceFullRoomListRefreshAfterXLoops = 10
	}
	this.debounceFetchConversations()
	} else {
	talkBroadcastChannel.postMessage({ message: 'force-fetch-all-conversations', options })
	}
	},

	async fetchConversations() {
	if (this.isFetchingConversations) {
	return
	}

	this.isFetchingConversations = true
	if (this.forceFullRoomListRefreshAfterXLoops === 0) {
	this.roomListModifiedBefore = 0
	this.forceFullRoomListRefreshAfterXLoops = 10
	} else {
	this.forceFullRoomListRefreshAfterXLoops--
	}

	/**
	* Fetches the conversations from the server and then adds them one by one
	* to the store.
	*/
	try {
	const response = await this.$store.dispatch('fetchConversations', {
	modifiedSince: this.roomListModifiedBefore,
	includeLastMessage: this.isCompact ? 0 : 1,
	})

	// We can only support this with the HPB as otherwise rooms,
	// you are not currently active in, will not be removed anymore,
	// as there is no signaling message about it when the internal
	// signaling is used.
	if (loadState('spreed', 'signaling_mode') !== 'internal') {
	if (response?.headers && response.headers['x-nextcloud-talk-modified-before']) {
	this.roomListModifiedBefore = response.headers['x-nextcloud-talk-modified-before']
	}
	}

	/**
	* Emits a global event that is used in App.vue to update the page title once the
	* ( if the current route is a conversation and once the conversations are received)
	*/
	EventBus.emit('conversations-received', { singleConversation: false })
	this.isFetchingConversations = false
	} catch (error) {
	console.debug('Error while fetching conversations: ', error)
	this.isFetchingConversations = false
	}
	},

	async restoreConversations() {
	try {
	await this.$store.dispatch('restoreConversations')
	EventBus.emit('conversations-received', { singleConversation: false })
	} catch (error) {
	console.debug('Error while restoring conversations: ', error)
	}
	},

	handleConversationsReceived() {
	this.handleUnreadMention()
	if (this.$route.params.token) {
	this.showArchived = this.$store.getters.conversation(this.$route.params.token)?.isArchived ?? false
	this.scrollToConversation(this.$route.params.token)
	}
	},

	// Checks whether the conversations list is scrolled all the way to the top
	// or not
	handleScroll() {
	this.handleUnreadMention()
	},

	/**
	* Find position of the last unread conversation below viewport
	*/
	async handleUnreadMention() {
	await this.$nextTick()

	this.lastUnreadMentionBelowViewportIndex = null
	const lastConversationInViewport = this.$refs.scroller.getLastItemInViewportIndex()
	for (let i = this.filteredConversationsList.length - 1; i > lastConversationInViewport; i--) {
	if (hasUnreadMentions(this.filteredConversationsList[i])) {
	this.lastUnreadMentionBelowViewportIndex = i
	return
	}
	}
	},

	async scrollToConversation(token) {
	await this.$nextTick()

	if (!this.$refs.scroller) {
	return
	}

	this.$refs.scroller.scrollToConversation(token)
	},

	onRouteChange({ from, to }) {
	if (from.name === 'conversation'
	&& to.name === 'conversation'
	&& from.params.token === to.params.token) {
	// this is triggered when the hash in the URL changes
	return
	}
	if (from.name === 'conversation') {
	this.$store.dispatch('leaveConversation', { token: from.params.token })
	if (to.name !== 'conversation') {
	this.$store.dispatch('updateToken', '')
	}
	}
	if (to.name === 'conversation') {
	this.abortSearch()
	this.$store.dispatch('joinConversation', { token: to.params.token })
	this.showArchived = this.$store.getters.conversation(to.params.token)?.isArchived ?? false
	this.scrollToConversation(to.params.token)
	}
	if (this.isMobile) {
	emit('toggle-navigation', {
	open: false,
	})
	}
	},

	showTalkDashboard() {
	this.$router.push({ name: 'root' })
	.catch((err) => console.debug(`Error while pushing the dashboard route: ${err}`))
	},
	},
	}
</script>

<style lang="scss" scoped="">
	.scroller {
	height: 100%;
	padding-inline: var(--default-grid-baseline);
	overflow-y: auto;
	line-height: 20px;
	}
	.sidebar-tabs {
	display: flex;
	gap: 10px;
	margin-bottom: 25px;
	height: 35px;
	width: 75%; /* Растягивает контейнер на всю ширину */
	margin: 0 auto;
	}

	.sidebar-tabs button {
	min-width: 100px;
	height: 35px;
	padding: 0 16px;
	background: none;
	border: 1px solid transparent;
	border-radius: 8px;
	font-size: 16px;
	cursor: pointer;
	transition: background 0.2s, color 0.2s, border 0.2s;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	}

	.sidebar-tabs .is-active {
	font-weight: bold;
	background: rgba(0, 155, 122, 0.80);
	border: 1px solid rgba(0, 155, 122, 0.30);
	box-shadow: 0 2px 6px rgba(0, 155, 122, 0.2);
	color: #fff;
	}

	.sidebar-tabs button:not(.is-active):hover {
	background: rgba(0, 155, 122, 0.1); /* Светлый фон при наведении — чтобы не было серого */
	border: 1px solid rgba(0, 155, 122, 0.30);
	box-shadow: 0 4px 6px rgba(0, 155, 122, 0.10);
	color: rgba(0, 155, 122, 1);
	}

	:deep(.placeholder-item) {
	display: none !important;
	}
	.new-conversation {
	position: relative;
	display: flex;
	margin: calc(var(--default-grid-baseline) * 2);
	align-items: center;

	.filters {
	position: absolute;
	top: 0;
	inset-inline-end: calc(var(--default-grid-baseline) + var(--default-clickable-area));
	}

	.actions {
	position: absolute;
	top: 0;
	inset-inline-end: 0;
	}
	}

	.invitation-button {
	padding-inline: calc(var(--default-grid-baseline) * 2);
	margin-block: var(--default-grid-baseline);

	:deep(.app-navigation-entry-link) {
	padding-inline-start: var(--default-grid-baseline);
	}

	:deep(.app-navigation-entry-icon) {
	flex: 0 0 40px !important; // AVATAR.SIZE.DEFAULT
	}

	:deep(.app-navigation-entry__name) {
	padding-inline-start: calc(2 * var(--default-grid-baseline));
	font-weight: 500;
	}
	}

	.unread-mention-button {
	position: absolute !important;
	/* stylelint-disable-next-line csstools/use-logical */
	left: 50%;
	transform: translateX(-50%);
	z-index: 100;
	bottom: 10px;
	white-space: nowrap;
	}

	.conversations-search {
	transition: all 0.15s ease;
	z-index: 1;
	// TODO replace with NcAppNavigationSearch
	width: calc(100% - var(--default-grid-baseline) * 3 - var(--default-clickable-area) * 3);
	display: flex;
	margin-inline-start: calc(var(--default-clickable-area) + var(--default-grid-baseline));

	&--expanded {
	width: 100%;
	margin-inline-start: 0;
	}

	:deep(.input-field) {
	margin-block-start: 0;
	}
	}

	.talk-home-button {
	margin-inline-end: var(--default-grid-baseline);
	position: absolute !important;
	}

	.conversations__filters {
	display: flex;
	flex-wrap: wrap;
	gap: var(--default-grid-baseline);
	margin: var(--default-grid-baseline) calc(var(--default-grid-baseline) * 2);
	}

	.left-sidebar__settings-button-container {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
	padding: calc(2 * var(--default-grid-baseline));
	}

	.left-sidebar__settings-button-bubble {
	margin-inline: var(--default-grid-baseline);
	color: var(--color-primary-element);
	}

	:deep(.empty-content) {
	text-align: center;
	padding: 20% 10px 0;
	}

	:deep(.app-navigation__list) {
	padding: 0 !important;
	}
</style>
