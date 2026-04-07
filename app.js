// =====================
// Module Navigation
// =====================
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.module-page');
const quickBtns = document.querySelectorAll('.quick-btn');
const mainContent = document.getElementById('mainContent');
const globalSearchInput = document.querySelector('.search-bar input');
const dashboardActiveMembersStat = document.getElementById('dashboardActiveMembersStat');
const dashboardHeadmatesStat = document.getElementById('dashboardHeadmatesStat');
const dashboardUnreadMessagesStat = document.getElementById('dashboardUnreadMessagesStat');
const dashboardHistoryEventsStat = document.getElementById('dashboardHistoryEventsStat');
const dashboardActivityList = document.getElementById('dashboardActivityList');
const dashboardModulePreviewGrid = document.getElementById('dashboardModulePreviewGrid');
const dashboardCompletionList = document.getElementById('dashboardCompletionList');
const dashboardHeroTitle = document.getElementById('dashboardHeroTitle');
const dashboardHeroSubtitle = document.getElementById('dashboardHeroSubtitle');
const dashboardCompletionAverage = document.getElementById('dashboardCompletionAverage');
const dashboardPreviewCount = document.getElementById('dashboardPreviewCount');
const dashboardCompletionChart = document.getElementById('dashboardCompletionChart');
const dashboardActivityChart = document.getElementById('dashboardActivityChart');
const dashboardCategoryPieChart = document.getElementById('dashboardCategoryPieChart');
const dashboardCommunicationPieChart = document.getElementById('dashboardCommunicationPieChart');
const tagTypeFilter = document.getElementById('tagTypeFilter');
const clearTagFilterBtn = document.getElementById('clearTagFilterBtn');
const tagSummary = document.getElementById('tagSummary');
const tagCloud = document.getElementById('tagCloud');
const tagResultsGrid = document.getElementById('tagResultsGrid');
let activeTagFilter = 'all';

function repairSavedCriticalTabState() {
  try {
    const criticalModules = ['chat', 'messages', 'health', 'switchboard', 'gallery', 'templates', 'calendar', 'notifications', 'profile', 'settings'];
    const storageKeys = ['ispd7.hub.state.v1', 'ispd7.hub.state.backup.v1'];

    storageKeys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;

      data.moduleVisibilitySettings = { ...(data.moduleVisibilitySettings || {}) };
      criticalModules.forEach((name) => {
        data.moduleVisibilitySettings[name] = true;
      });

      data.privacySettings = {
        ...(data.privacySettings || {}),
        healthVisible: true,
        historyVisible: true,
        locationsVisible: true,
        journalVisible: true,
        partnersVisible: true
      };

      localStorage.setItem(key, JSON.stringify(data));
    });
  } catch (_err) {
    // Ignore malformed saved state during reset.
  }
}

function applyUrlResetIfRequested() {
  if (typeof window === 'undefined' || !window.location) return;

  const params = new URLSearchParams(window.location.search || '');
  if (params.get('reset') !== '1') return;

  repairSavedCriticalTabState();
  params.delete('reset');

  if (window.history && typeof window.history.replaceState === 'function') {
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
  }
}

applyUrlResetIfRequested();

const APP_CONFIG = window.APP_CONFIG || {};
const API_BASE_URL = String(APP_CONFIG.apiBaseUrl || '').trim().replace(/\/+$/, '');
const USE_BACKEND_AUTH = Boolean(APP_CONFIG.useBackendAuth && API_BASE_URL);

const DEFAULT_TERMINOLOGY = {
  headmates: 'Headmates',
  system: 'System',
  subsystem: 'Subsystems',
  innerworld: 'Innerworld',
  partners: 'Partners'
};

const terminologySettings = { ...DEFAULT_TERMINOLOGY };

function getTermLabel(key) {
  return String(terminologySettings[key] || DEFAULT_TERMINOLOGY[key] || key).trim();
}

function getSingularTerm(key) {
  const label = getTermLabel(key);
  if (/ies$/i.test(label)) return label.replace(/ies$/i, 'y');
  if (/s$/i.test(label) && !/ss$/i.test(label)) return label.slice(0, -1);
  return label;
}

function getTermCountLabel(key, count) {
  return count === 1 ? getSingularTerm(key) : getTermLabel(key);
}

function getPluralTerm(key) {
  const label = getTermLabel(key);
  if (/ies$/i.test(label) || (/s$/i.test(label) && !/ss$/i.test(label))) return label;
  if (/y$/i.test(label)) return label.replace(/y$/i, 'ies');
  return `${label}s`;
}

function truncatePreview(text, maxLength = 72) {
  const value = String(text || '').trim();
  if (!value) return 'No preview available yet.';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function isFilledDashboardField(value, options = {}) {
  if (options.alwaysCount) return true;
  const raw = String(value ?? '').trim();
  if (!raw) return false;

  const normalized = raw.toLowerCase();
  const placeholders = ['not set', 'none', 'n/a', 'no description set.', 'new user profile'];
  if (placeholders.includes(normalized)) return false;

  if (options.profileName && normalized === `${String(options.profileName).trim().toLowerCase()} banner`) return false;
  if (options.username && normalized === `${String(options.username).trim().toLowerCase()} banner`) return false;
  if (options.initial && normalized === String(options.initial).trim().toLowerCase()) return false;

  return true;
}

function calculateDashboardCompletion(profile, fieldRules = []) {
  const profileName = profile?.name || profile?.username || '';
  const username = profile?.username || '';
  const initial = (profileName || username || '?')[0]?.toUpperCase() || '?';
  const total = fieldRules.length || 1;
  const filled = fieldRules.filter((rule) => isFilledDashboardField(profile?.[rule.key], {
    profileName,
    username,
    initial,
    alwaysCount: rule.alwaysCount
  })).length;
  const percent = Math.round((filled / total) * 100);
  return { filled, total, percent };
}

function getDashboardCompletionStatus(percent) {
  if (percent >= 90) return 'Complete';
  if (percent >= 70) return 'Strong';
  if (percent >= 45) return 'Growing';
  return 'Needs details';
}

function renderDashboardCompletionStatus() {
  if (!dashboardCompletionList) return { avgPercent: 0, count: 0 };

  const systemRules = [
    { key: 'name', alwaysCount: true },
    { key: 'nickname' },
    { key: 'description' },
    { key: 'tags' },
    { key: 'customFields' },
    { key: 'profilePhoto' },
    { key: 'banner' },
    { key: 'color', alwaysCount: true },
    { key: 'trustLevel', alwaysCount: true }
  ];
  const accountRules = [
    { key: 'name', alwaysCount: true },
    { key: 'username', alwaysCount: true },
    { key: 'description' },
    { key: 'tags' },
    { key: 'customFields' },
    { key: 'profilePhoto' },
    { key: 'banner' }
  ];

  const activeUser = typeof getActiveUserName === 'function' ? getActiveUserName() : '';
  const entries = [];

  if (typeof systemProfiles === 'object' && systemProfiles) {
    Object.entries(systemProfiles).forEach(([userKey, profile]) => {
      const stats = calculateDashboardCompletion(profile, systemRules);
      entries.push({
        name: profile?.name || userKey,
        subtitle: userKey === activeUser ? 'Active system' : 'System profile',
        color: profile?.color || '#6c63ff',
        sortBoost: userKey === activeUser ? 2 : 0,
        ...stats,
        status: getDashboardCompletionStatus(stats.percent)
      });
    });
  }

  if (typeof accounts === 'object' && loggedInAccountKey && accounts[loggedInAccountKey]) {
    const accountProfile = accounts[loggedInAccountKey];
    const stats = calculateDashboardCompletion(accountProfile, accountRules);
    entries.unshift({
      name: `@${loggedInAccountKey}`,
      subtitle: 'Signed-in account',
      color: accountProfile?.color || '#43d9ad',
      sortBoost: 3,
      ...stats,
      status: getDashboardCompletionStatus(stats.percent)
    });
  }

  if (!entries.length) {
    dashboardCompletionList.innerHTML = '<p class="headmate-hint" style="margin:8px 0">No account data available yet.</p>';
    if (dashboardCompletionAverage) dashboardCompletionAverage.textContent = '0';
    return {
      trackedCount: 0,
      breakdown: { complete: 0, strong: 0, growing: 0, needsDetails: 0 }
    };
  }

  const breakdown = entries.reduce((acc, entry) => {
    if (entry.percent >= 90) acc.complete += 1;
    else if (entry.percent >= 70) acc.strong += 1;
    else if (entry.percent >= 45) acc.growing += 1;
    else acc.needsDetails += 1;
    return acc;
  }, { complete: 0, strong: 0, growing: 0, needsDetails: 0 });

  if (dashboardCompletionAverage) dashboardCompletionAverage.textContent = String(breakdown.complete);

  dashboardCompletionList.innerHTML = entries
    .sort((a, b) => (Number(b.sortBoost || 0) - Number(a.sortBoost || 0)) || (b.percent - a.percent))
    .map((entry) => `
      <article class="dashboard-completion-card">
        <div class="dashboard-completion-head">
          <div>
            <strong>${escapeHtml(entry.name)}</strong>
            <span>${escapeHtml(entry.subtitle)}</span>
          </div>
          <span class="badge">${escapeHtml(entry.status)}</span>
        </div>
        <div class="dashboard-completion-meta">
          <span>${entry.filled}/${entry.total} fields filled</span>
          <strong>${entry.percent}%</strong>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${entry.percent}%; background:${escapeHtml(entry.color)}"></div>
        </div>
      </article>
    `).join('');

  return {
    trackedCount: entries.length,
    breakdown
  };
}

function renderPieChartMarkup(title, items = []) {
  const safeItems = items.filter((item) => Number(item.value || 0) > 0);
  const total = safeItems.reduce((sum, item) => sum + Number(item.value || 0), 0);

  if (!total) {
    return '<p class="headmate-hint" style="margin:8px 0">Not enough data yet to draw this pie chart.</p>';
  }

  let running = 0;
  const segments = safeItems.map((item) => {
    const start = running;
    const next = running + (Number(item.value || 0) / total) * 100;
    running = next;
    return `${item.color} ${start}% ${next}%`;
  }).join(', ');

  return `
    <div class="dashboard-pie-wrap">
      <div class="dashboard-pie" style="background: conic-gradient(${segments});">
        <div class="dashboard-pie-center">
          <strong>${total}</strong>
          <span>${escapeHtml(title)}</span>
        </div>
      </div>
      <div class="dashboard-chart-legend">
        ${safeItems.map((item) => `
          <div>
            <span class="chart-dot" style="--dot-color:${item.color};"></span>
            <strong>${Number(item.value || 0)}</strong> ${escapeHtml(item.label)}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderDashboardCharts(summary = {}) {
  const completionBreakdown = summary.completionBreakdown || { complete: 0, strong: 0, growing: 0, needsDetails: 0 };
  const systemsCount = Number(summary.systemsCount || 0);
  const accountCount = Number(summary.accountCount || 0);
  const headmateCount = Number(summary.headmateCount || 0);
  const partnerCount = Number(summary.partnerCount || 0);
  const subsystemCount = Number(summary.subsystemCount || 0);
  const locationCount = Number(summary.locationCount || 0);
  const journalCount = Number(summary.journalCount || 0);
  const chatCount = Number(summary.chatCount || 0);
  const unreadCount = Number(summary.unreadCount || 0);
  const historyCount = Number(summary.historyCount || 0);

  if (dashboardCompletionChart) {
    dashboardCompletionChart.innerHTML = renderPieChartMarkup('profiles', [
      { label: 'Complete', value: completionBreakdown.complete || 0, color: '#22c55e' },
      { label: 'Strong', value: completionBreakdown.strong || 0, color: 'var(--accent)' },
      { label: 'Growing', value: completionBreakdown.growing || 0, color: '#f5a623' },
      { label: 'Needs details', value: completionBreakdown.needsDetails || 0, color: '#ff6584' }
    ]);
  }

  if (dashboardActivityChart) {
    const bars = [
      { label: 'Headmates', value: headmateCount, color: 'var(--accent)' },
      { label: 'Partners', value: partnerCount, color: '#ff6584' },
      { label: 'Subsystems', value: subsystemCount, color: '#43d9ad' },
      { label: 'Locations', value: locationCount, color: '#0984e3' },
      { label: 'Journal', value: journalCount, color: '#f5a623' },
      { label: 'Chats', value: chatCount, color: '#a29bfe' }
    ];
    const maxValue = Math.max(1, ...bars.map((bar) => Number(bar.value || 0)));

    dashboardActivityChart.innerHTML = `
      <div class="dashboard-bar-chart">
        ${bars.map((bar) => `
          <div class="dashboard-bar-row">
            <span class="dashboard-bar-label">${escapeHtml(bar.label)}</span>
            <div class="dashboard-bar-track">
              <div class="dashboard-bar-fill" style="width:${Math.max(8, Math.round((Number(bar.value || 0) / maxValue) * 100))}%; --bar-color:${bar.color};"></div>
            </div>
            <strong>${Number(bar.value || 0)}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (dashboardCategoryPieChart) {
    dashboardCategoryPieChart.innerHTML = renderPieChartMarkup('records', [
      { label: 'Headmates', value: headmateCount, color: 'var(--accent)' },
      { label: 'Partners', value: partnerCount, color: '#ff6584' },
      { label: 'Subsystems', value: subsystemCount, color: '#43d9ad' },
      { label: 'Locations', value: locationCount, color: '#0984e3' }
    ]);
  }

  if (dashboardCommunicationPieChart) {
    dashboardCommunicationPieChart.innerHTML = renderPieChartMarkup('updates', [
      { label: 'Journal', value: journalCount, color: '#f5a623' },
      { label: 'Chats', value: chatCount, color: '#a29bfe' },
      { label: 'Unread', value: unreadCount, color: '#22c55e' },
      { label: 'History', value: historyCount, color: '#e17055' }
    ]);
  }
}

function renderDashboardModulePreviews() {
  if (!dashboardModulePreviewGrid) return;

  const user = typeof getActiveUserName === 'function' ? getActiveUserName() : 'Alice';
  const activeHeadmates = typeof getActiveHeadmateProfiles === 'function' ? Object.values(getActiveHeadmateProfiles()) : [];
  const systemList = typeof systemProfiles === 'object' ? Object.keys(systemProfiles) : [];
  const partnerList = typeof partnerProfiles === 'object' ? Object.values(partnerProfiles) : [];
  const subsystemList = typeof getActiveSubsystems === 'function' ? Object.values(getActiveSubsystems()) : [];
  const itemList = typeof itemProfiles === 'object' ? Object.values(itemProfiles) : [];
  const journalListForUser = typeof ensureJournalEntryStore === 'function' ? ensureJournalEntryStore(user) : [];
  const medicationList = typeof ensureMedicationStore === 'function' ? ensureMedicationStore(user) : [];
  const locationList = typeof locationProfiles === 'object' ? Object.values(locationProfiles) : [];
  const templateList = typeof customTemplates === 'object' ? Object.values(customTemplates) : [];
  const historyList = typeof historyEvents !== 'undefined' ? historyEvents : [];
  const accountList = typeof accounts === 'object' ? Object.keys(accounts) : [];
  const tagRecords = typeof getTaggableProfileRecords === 'function' ? getTaggableProfileRecords() : [];
  const uniqueTags = [...new Set(tagRecords.flatMap((record) => record.tags || []).map((tag) => normalizeLookupName(tag)).filter(Boolean))];
  const chatThreads = typeof chatMessagesByUser === 'object' ? Object.values(chatMessagesByUser[user] || {}) : [];
  const latestChatEntry = chatThreads.flat().sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))[0];
  const latestMessageSubject = document.querySelector('#page-messages tbody tr td:nth-child(2)')?.textContent?.trim() || 'Inbox overview';
  const ruleCount = document.querySelectorAll('#page-switchboard .journal-card').length;
  const mediaCount = document.querySelectorAll('#page-gallery .gallery-item').length;
  const appTitleText = document.getElementById('appTitle')?.textContent?.trim() || 'System Hub';

  const previewMap = {
    parts: {
      count: activeHeadmates.length,
      summary: activeHeadmates.slice(0, 3).map((profile) => profile.name).join(', ') || `No ${getPluralTerm('headmates').toLowerCase()} yet`,
      meta: 'Folders, tags, and profile cards'
    },
    system: {
      count: systemList.length,
      summary: systemList.length ? `Active: ${user}` : 'No systems added yet',
      meta: 'Switch and edit system accounts'
    },
    friends: {
      count: partnerList.length,
      summary: partnerList[0]?.name ? `Latest: ${partnerList[0].name}` : 'No partners tracked yet',
      meta: 'Relationship tracker'
    },
    partners: {
      count: subsystemList.length,
      summary: subsystemList[0]?.name ? `Latest: ${subsystemList[0].name}` : 'No subsystems yet',
      meta: 'Membership hubs and links'
    },
    items: {
      count: itemList.length,
      summary: itemList[0]?.name ? `Latest: ${itemList[0].name}` : 'No items saved yet',
      meta: 'Tagged objects and linked items'
    },
    tags: {
      count: uniqueTags.length,
      summary: uniqueTags.length ? `Top tags: ${tagRecords.slice(0, 3).flatMap((record) => record.tags).slice(0, 3).join(', ')}` : 'No tags saved yet',
      meta: 'Cross-profile tag browser'
    },
    journal: {
      count: journalListForUser.length,
      summary: journalListForUser[0]?.title || 'No journal entries yet',
      meta: 'Recent system journaling'
    },
    chat: {
      count: chatThreads.filter((thread) => thread.length).length,
      summary: latestChatEntry ? (latestChatEntry.type === 'poll' ? `Poll: ${latestChatEntry.question || 'Untitled poll'}` : latestChatEntry.text || 'Recent chat message') : 'No chat activity yet',
      meta: 'Inner chat conversations'
    },
    messages: {
      count: document.querySelectorAll('#page-messages .badge.green').length,
      summary: latestMessageSubject,
      meta: 'Inbox and notifications'
    },
    health: {
      count: medicationList.length,
      summary: medicationList[0]?.name ? `Tracking: ${medicationList[0].name}` : 'No meds tracked yet',
      meta: 'Medication and health log'
    },
    switchboard: {
      count: ruleCount,
      summary: ruleCount ? `${ruleCount} rule${ruleCount === 1 ? '' : 's'} set` : 'No rules yet',
      meta: 'Safety and communication rules'
    },
    gallery: {
      count: mediaCount,
      summary: `${mediaCount} media item${mediaCount === 1 ? '' : 's'} available`,
      meta: 'Media library preview'
    },
    templates: {
      count: templateList.length,
      summary: templateList[0]?.name ? `Latest: ${templateList[0].name}` : 'No templates saved yet',
      meta: 'Reusable form templates'
    },
    calendar: {
      count: historyList.length,
      summary: historyList[0]?.title || 'No history events yet',
      meta: 'Timeline and milestones'
    },
    notifications: {
      count: locationList.length,
      summary: locationList[0]?.name ? `Focused: ${locationList[0].name}` : 'No innerworld locations yet',
      meta: 'Innerworld map and places'
    },
    profile: {
      count: accountList.length,
      summary: loggedInAccountKey ? `Signed in as @${loggedInAccountKey}` : 'No account signed in',
      meta: 'Account profile tools'
    },
    settings: {
      count: document.body.classList.contains('dark') ? 'Dark' : 'Light',
      summary: appTitleText,
      meta: 'Theme, privacy, and terminology'
    }
  };

  const navEntries = Array.from(document.querySelectorAll('.sidebar .nav-item'))
    .filter((item) => item.dataset.module && item.dataset.module !== 'dashboard')
    .map((item) => ({
      module: item.dataset.module,
      label: item.querySelector('.nav-label')?.textContent?.trim() || item.dataset.module,
      icon: item.querySelector('.nav-icon')?.textContent?.trim() || '•'
    }));

  if (dashboardPreviewCount) dashboardPreviewCount.textContent = String(navEntries.length);

  dashboardModulePreviewGrid.innerHTML = navEntries.map(({ module, label, icon }) => {
    const preview = previewMap[module] || { count: '—', summary: 'Open this tab to manage its information.', meta: 'Preview unavailable' };
    return `
      <button class="dashboard-preview-card" type="button" data-dashboard-module="${module}">
        <div class="dashboard-preview-head">
          <span class="dashboard-preview-title"><span class="dashboard-preview-icon">${escapeHtml(icon)}</span><strong>${escapeHtml(label)}</strong></span>
          <span class="badge">${escapeHtml(String(preview.count ?? '—'))}</span>
        </div>
        <p>${escapeHtml(truncatePreview(preview.summary))}</p>
        <small>${escapeHtml(preview.meta || 'Open this tab')}</small>
      </button>
    `;
  }).join('');
}

function renderDashboard() {
  try {
    const user = getActiveUserName();
    const systemsCount = document.querySelectorAll('.user-option[data-user]').length;
    const headmateCount = Object.keys(getActiveHeadmateProfiles()).length;
    const journalCount = ensureJournalEntryStore(user).length;

    if (dashboardActiveMembersStat) {
      dashboardActiveMembersStat.textContent = String(systemsCount);
      dashboardActiveMembersStat.closest('.card')?.querySelector('h3')?.replaceChildren(document.createTextNode('Systems'));
    }
    if (dashboardHeadmatesStat) {
      dashboardHeadmatesStat.textContent = String(headmateCount);
      dashboardHeadmatesStat.closest('.card')?.querySelector('h3')?.replaceChildren(document.createTextNode(getTermLabel('headmates')));
    }
    if (dashboardUnreadMessagesStat) {
      dashboardUnreadMessagesStat.textContent = String(document.querySelectorAll('#page-messages .badge.green').length);
    }
    if (dashboardHistoryEventsStat) {
      dashboardHistoryEventsStat.textContent = String(historyEvents.length);
    }

    const completionInfo = renderDashboardCompletionStatus();
    const unreadCount = document.querySelectorAll('#page-messages .badge.green').length;
    const partnerCount = typeof partnerProfiles === 'object' ? Object.keys(partnerProfiles).length : 0;
    const subsystemCount = typeof getActiveSubsystems === 'function' ? Object.keys(getActiveSubsystems()).length : 0;
    const locationCount = typeof locationProfiles === 'object' ? Object.keys(locationProfiles).length : 0;
    const accountCount = typeof accounts === 'object' ? Object.keys(accounts).length : 0;
    const chatCount = typeof chatMessagesByUser === 'object' ? Object.values(chatMessagesByUser[user] || {}).filter((thread) => Array.isArray(thread) && thread.length).length : 0;

    if (dashboardHeroTitle) {
      const systemLabel = user === NO_SYSTEM_USER ? '' : user;
      const welcomeName = (typeof accounts === 'object' && loggedInAccountKey && accounts[loggedInAccountKey]?.name) || systemLabel || 'friend';
      dashboardHeroTitle.textContent = `Welcome back, ${welcomeName}`;
    }
    if (dashboardHeroSubtitle) {
      dashboardHeroSubtitle.textContent = `${systemsCount} systems, ${headmateCount} ${getPluralTerm('headmates').toLowerCase()}, ${journalCount} journal entr${journalCount === 1 ? 'y' : 'ies'}, and ${completionInfo.breakdown.complete || 0} complete profile${(completionInfo.breakdown.complete || 0) === 1 ? '' : 's'}.`;
    }

    renderDashboardCharts({
      completionBreakdown: completionInfo.breakdown,
      systemsCount,
      accountCount,
      headmateCount,
      partnerCount,
      subsystemCount,
      locationCount,
      journalCount,
      chatCount,
      unreadCount,
      historyCount: historyEvents.length
    });

    if (dashboardActivityList) {
      const items = [];
      ensureJournalEntryStore(user).slice(0, 3).forEach((entry) => {
        items.push({ ts: entry.createdAt || Date.now(), badge: entry.tag || 'Journal', text: `Logged "${entry.title}"` });
      });
      ensureMedicationCheckinStore(user).slice(-2).forEach((entry) => {
        items.push({ ts: entry.takenAt || Date.now(), badge: 'Health', text: `Medication taken: ${entry.medName}` });
      });
      getSortedHistoryEvents({ ignoreFilters: true }).slice(0, 3).forEach((entry) => {
        items.push({ ts: new Date(`${entry.date || '1970-01-01'}T00:00:00`).getTime(), badge: entry.type || 'History', text: entry.title });
      });

      const recent = items.sort((a, b) => b.ts - a.ts).slice(0, 5);
      dashboardActivityList.innerHTML = recent.length
        ? recent.map((item) => `<li><span class="badge">${escapeHtml(item.badge)}</span> ${escapeHtml(item.text)}</li>`).join('')
        : `<li><span class="badge">${escapeHtml(getTermLabel('system'))}</span> No recent activity yet.</li>`;
    }

    renderDashboardModulePreviews();
    if (typeof renderTagsModule === 'function') renderTagsModule();
  } catch (_err) {
    // Some stores initialize later; dashboard will refresh again after setup.
  }
}

function navigateTo(module) {
  if (typeof isSignedIn === 'function' && !isSignedIn() && module === 'accountFriends') {
    safeAlert('Please sign in to manage account friends.');
    module = 'profile';
  }

  if (module !== 'profile' && module !== 'settings' && typeof isModuleEnabled === 'function' && !isModuleEnabled(module)) {
    safeAlert('That tab is currently turned off in settings.');
    module = typeof getFirstVisibleModule === 'function' ? getFirstVisibleModule('dashboard') : 'dashboard';
  }

  if (module !== 'profile' && typeof canAccessModule === 'function' && !canAccessModule(module)) {
    safeAlert(`That section is hidden for your current trust level.`);
    module = typeof getFirstVisibleModule === 'function' ? getFirstVisibleModule('dashboard') : 'dashboard';
  }

  navItems.forEach(i => i.classList.toggle('active', i.dataset.module === module));
  pages.forEach(p => p.classList.toggle('active', p.id === `page-${module}`));

  const activePage = document.getElementById(`page-${module}`) || document.querySelector('.module-page.active');
  if (mainContent) {
    mainContent.scrollTop = 0;
    if (typeof mainContent.scrollTo === 'function') mainContent.scrollTo(0, 0);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }
  if (activePage && typeof activePage.scrollIntoView === 'function') {
    try {
      activePage.scrollIntoView({ block: 'start', inline: 'nearest' });
    } catch (_err) {
      activePage.scrollIntoView();
    }
  }
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      if (mainContent) mainContent.scrollTop = 0;
      if (typeof document !== 'undefined') {
        document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      }
    });
  }
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    window.setTimeout(() => {
      if (mainContent) mainContent.scrollTop = 0;
      if (activePage && typeof activePage.scrollIntoView === 'function') {
        try {
          activePage.scrollIntoView({ block: 'start', inline: 'nearest' });
        } catch (_err) {
          activePage.scrollIntoView();
        }
      }
    }, 0);
  }
  // Fail-safe: never allow the content area to end up with zero visible pages.
  if (!document.querySelector('.module-page.active')) {
    const fallbackPage = document.getElementById('page-dashboard') || document.querySelector('.module-page');
    if (fallbackPage) {
      fallbackPage.classList.add('active');
      const fallbackModule = fallbackPage.id.replace(/^page-/, '');
      navItems.forEach(i => i.classList.toggle('active', i.dataset.module === fallbackModule));
    }
  }
  renderDashboard();
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navigateTo(item.dataset.module);
    if (isMobileScreen()) setSidebarCollapsed(true);
  });
});

quickBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navigateTo(btn.dataset.module);
    if (isMobileScreen()) setSidebarCollapsed(true);
  });
});

if (dashboardModulePreviewGrid) {
  dashboardModulePreviewGrid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-dashboard-module]');
    if (!card) return;
    navigateTo(card.dataset.dashboardModule);
    if (isMobileScreen()) setSidebarCollapsed(true);
  });
}

// =====================
// Sidebar Toggle
// =====================
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const compactSidebarSwitch = document.getElementById('compactSidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const mobileQuery = window.matchMedia('(max-width: 760px)');

function isMobileScreen() {
  return mobileQuery.matches;
}

function setSidebarCollapsed(collapsed) {
  if (isMobileScreen()) {
    sidebar.classList.toggle('mobile-open', !collapsed);
    sidebar.classList.remove('collapsed');
    if (sidebarBackdrop) sidebarBackdrop.classList.toggle('open', !collapsed);
    if (compactSidebarSwitch) compactSidebarSwitch.checked = false;
    return;
  }

  sidebar.classList.toggle('collapsed', collapsed);
  sidebar.classList.remove('mobile-open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('open');
  if (compactSidebarSwitch) compactSidebarSwitch.checked = collapsed;
}

sidebarToggle.addEventListener('click', () => {
  const isOpen = isMobileScreen()
    ? sidebar.classList.contains('mobile-open')
    : !sidebar.classList.contains('collapsed');

  setSidebarCollapsed(isOpen);
});

if (compactSidebarSwitch) {
  compactSidebarSwitch.addEventListener('change', () => {
    setSidebarCollapsed(compactSidebarSwitch.checked);
  });
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener('click', () => setSidebarCollapsed(true));
}

window.addEventListener('resize', () => {
  if (!isMobileScreen()) {
    sidebar.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('open');
  }
});

if (isMobileScreen()) {
  setSidebarCollapsed(true);
}

// =====================
// Dark Mode
// =====================
const darkModeSwitch = document.getElementById('darkModeSwitch');
const darkModeSettingSwitch = document.getElementById('darkModeSettingSwitch');
const fontSizeSetting = document.getElementById('fontSizeSetting');
const fontSizeValue = document.getElementById('fontSizeValue');
const resetFontSizeBtn = document.getElementById('resetFontSizeBtn');
const DEFAULT_FONT_SIZE = 15;

function setDarkMode(enabled) {
  document.body.classList.toggle('dark', enabled);
  if (darkModeSwitch) darkModeSwitch.checked = enabled;
  if (darkModeSettingSwitch) darkModeSettingSwitch.checked = enabled;
  localStorage.setItem('darkMode', enabled ? '1' : '0');
}

function applyFontSize(size) {
  const px = Math.max(12, Math.min(22, Number(size) || DEFAULT_FONT_SIZE));
  document.documentElement.style.setProperty('--base-font-size', `${px}px`);
  if (fontSizeSetting) fontSizeSetting.value = String(px);
  if (fontSizeValue) fontSizeValue.textContent = `${px}px`;
  localStorage.setItem('fontSizePx', String(px));
}

// Sync both toggles
if (darkModeSwitch) {
  darkModeSwitch.addEventListener('change', () => setDarkMode(darkModeSwitch.checked));
}
if (darkModeSettingSwitch) {
  darkModeSettingSwitch.addEventListener('change', () => setDarkMode(darkModeSettingSwitch.checked));
}
if (fontSizeSetting) {
  fontSizeSetting.addEventListener('input', () => applyFontSize(fontSizeSetting.value));
}
if (resetFontSizeBtn) {
  resetFontSizeBtn.addEventListener('click', () => applyFontSize(DEFAULT_FONT_SIZE));
}

// Load persisted preference
if (localStorage.getItem('darkMode') === '1') setDarkMode(true);
applyFontSize(localStorage.getItem('fontSizePx') || DEFAULT_FONT_SIZE);

function safePrompt(message, defaultValue = '') {
  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    try {
      return window.prompt(message, defaultValue);
    } catch (_err) {
      return defaultValue;
    }
  }
  return defaultValue;
}

function safeConfirm(message) {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    try {
      return window.confirm(message);
    } catch (_err) {
      return true;
    }
  }
  return true;
}

function safeAlert(message) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    try {
      window.alert(message);
    } catch (_err) {
      // no-op in restricted contexts
    }
  }
}

// =====================
// User Switcher
// =====================
const userSwitcherBtn = document.getElementById('userSwitcherBtn');
const userDropdown = document.getElementById('userDropdown');
const currentAvatar = document.getElementById('currentAvatar');
const currentUsername = document.getElementById('currentUsername');
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const systemActiveAvatar = document.getElementById('systemActiveAvatar');
const systemActiveName = document.getElementById('systemActiveName');
const systemProfilesGrid = document.getElementById('systemProfilesGrid');
const addSystemProfileBtn = document.getElementById('addSystemProfileBtn');
const addSystemFromTemplateBtn = document.getElementById('addSystemFromTemplateBtn');
const systemProfileDrafts = {};
const systemProfileEditor = document.getElementById('systemProfileEditor');
const systemEditName = document.getElementById('systemEditName');
const systemEditNickname = document.getElementById('systemEditNickname');
const systemEditDescription = document.getElementById('systemEditDescription');
const systemEditTags = document.getElementById('systemEditTags');
const systemEditCustomFields = document.getElementById('systemEditCustomFields');
const systemEditColor = document.getElementById('systemEditColor');
const systemEditColorPicker = document.getElementById('systemEditColorPicker');
const systemEditBanner = document.getElementById('systemEditBanner');
const systemEditPhoto = document.getElementById('systemEditPhoto');
const saveSystemEditorBtn = document.getElementById('saveSystemEditorBtn');
const cancelSystemEditorBtn = document.getElementById('cancelSystemEditorBtn');
const systemEditTrustLevel = document.getElementById('systemEditTrustLevel');
let editingSystemUser = null;
let creatingSystemProfile = false;
const NO_SYSTEM_USER = 'No system';
const MAX_SYSTEMS_PER_ACCOUNT = 10;
const MAX_HEADMATES_PER_ACCOUNT = 2000;

const systemProfiles = {};

function getSystemCountForAccount() {
  return Object.keys(systemProfiles || {}).length;
}

function getTotalHeadmateCountForAccount() {
  return Object.values(headmateProfilesByUser || {}).reduce((sum, profiles) => {
    return sum + Object.keys(profiles || {}).length;
  }, 0);
}

function canCreateSystemProfile(additionalSystems = 1, { silent = false } = {}) {
  const currentCount = getSystemCountForAccount();
  const allowed = currentCount + Number(additionalSystems || 0) <= MAX_SYSTEMS_PER_ACCOUNT;
  if (!allowed && !silent) {
    safeAlert(`Each account can have up to ${MAX_SYSTEMS_PER_ACCOUNT} systems/users in the top-left switcher.`);
  }
  return allowed;
}

function canCreateHeadmates(additionalHeadmates = 1, { silent = false } = {}) {
  const currentCount = getTotalHeadmateCountForAccount();
  const allowed = currentCount + Number(additionalHeadmates || 0) <= MAX_HEADMATES_PER_ACCOUNT;
  if (!allowed && !silent) {
    const remaining = Math.max(0, MAX_HEADMATES_PER_ACCOUNT - currentCount);
    safeAlert(`This account can store up to ${MAX_HEADMATES_PER_ACCOUNT} total headmates across all systems. You can add ${remaining} more right now.`);
  }
  return allowed;
}

function ensureSystemProfile(userName, initial, color) {
  if (!userName || userName === NO_SYSTEM_USER) return;
  if (!systemProfiles[userName]) {
    systemProfiles[userName] = {
      name: userName,
      nickname: `${initial}`,
      description: 'No description set.',
      tags: 'Not set',
      customFields: 'Not set',
      color,
      banner: `${userName} Banner`,
      profilePhoto: initial,
      trustLevel: 'private'
    };
  }
}

function setNoSystemSelected() {
  applyPhotoStyle(currentAvatar, '', '?', '#888');
  if (currentUsername) currentUsername.textContent = NO_SYSTEM_USER;
  if (systemActiveAvatar) applyPhotoStyle(systemActiveAvatar, '', '?', '#888');
  if (systemActiveName) systemActiveName.textContent = NO_SYSTEM_USER;
}

function migrateUserScopedData(fromUser, toUser) {
  const source = String(fromUser || '').trim();
  const target = String(toUser || '').trim();
  if (!source || !target || source === target) return;

  const stores = [
    typeof headmateProfilesByUser !== 'undefined' ? headmateProfilesByUser : null,
    typeof headmateFoldersByUser !== 'undefined' ? headmateFoldersByUser : null,
    typeof subsystemsByUser !== 'undefined' ? subsystemsByUser : null,
    typeof chatMessagesByUser !== 'undefined' ? chatMessagesByUser : null,
    typeof medicationsByUser !== 'undefined' ? medicationsByUser : null,
    typeof medicationCheckinsByUser !== 'undefined' ? medicationCheckinsByUser : null,
    typeof journalEntriesByUser !== 'undefined' ? journalEntriesByUser : null,
    typeof journalShortcutsByUser !== 'undefined' ? journalShortcutsByUser : null
  ].filter(Boolean);

  stores.forEach((store) => {
    if (!(source in store)) return;
    if (!(target in store)) {
      store[target] = store[source];
      delete store[source];
      return;
    }

    if (Array.isArray(store[source]) && Array.isArray(store[target])) {
      store[target] = [...store[source], ...store[target]];
      delete store[source];
      return;
    }

    if (typeof store[source] === 'object' && typeof store[target] === 'object') {
      store[target] = { ...store[source], ...store[target] };
      delete store[source];
    }
  });
}

function applyUserSelection(user, initial, color, activeOption) {
  ensureSystemProfile(user, initial, color);

  const activePhoto = systemProfiles[user]?.profilePhoto || initial;
  applyPhotoStyle(currentAvatar, activePhoto, initial, color);
  currentUsername.textContent = user;

  if (systemActiveAvatar) {
    applyPhotoStyle(systemActiveAvatar, activePhoto, initial, color);
  }
  if (systemActiveName) systemActiveName.textContent = user;

  document.querySelectorAll('.user-option').forEach(o => o.classList.remove('active'));
  if (activeOption) activeOption.classList.add('active');
  userDropdown.classList.remove('open');
  if (typeof renderHeadmatesTable === 'function') renderHeadmatesTable();
  if (typeof renderSubsystemsGrid === 'function') {
    selectedSubsystemKey = null;
    if (subsystemProfile) subsystemProfile.hidden = true;
    renderSubsystemsGrid();
  }
    if (typeof renderChatSidebar === 'function') {
      selectedChatAlterKey = null;
      renderChatSidebar();
    }
    if (typeof renderMedicationTracker === 'function') {
      renderMedicationTracker();
    }
    if (typeof renderJournalModule === 'function') {
      if (logShortcutEditor) logShortcutEditor.hidden = true;
      renderJournalModule();
    }
    renderSystemProfiles();
    const activeModule = document.querySelector('.nav-item.active')?.dataset.module || 'dashboard';
    if (typeof canAccessModule === 'function' && !canAccessModule(activeModule)) {
      navigateTo('dashboard');
    } else {
      renderDashboard();
    }
}

function attachUserOptionClick(option) {
  option.addEventListener('click', (e) => {
    e.stopPropagation();
    applyUserSelection(
      option.dataset.user,
      option.dataset.initial,
      option.dataset.color,
      option
    );
  });
}

function createUserOption(name, initial, color) {
  const option = document.createElement('div');
  option.className = 'user-option';
  option.dataset.user = name;
  option.dataset.initial = initial;
  option.dataset.color = color;
  option.innerHTML = `<div class="avatar" style="background:${color}">${initial}</div><span>${escapeHtml(name)}</span>`;
  attachUserOptionClick(option);
  return option;
}

function rebuildUserDropdownOptions(preferredUser = '') {
  if (!userDropdown) return;

  userDropdown.querySelectorAll('.user-option[data-user]').forEach((option) => option.remove());
  const addBtn = document.getElementById('addUserBtn');
  const separator = userDropdown.querySelector('hr');

  Object.entries(systemProfiles).forEach(([userName, profile]) => {
    const displayName = String(profile?.name || userName).trim() || userName;
    const initial = (profile?.profilePhoto || displayName[0] || '?').trim()[0]?.toUpperCase() || '?';
    const color = profile?.color || '#6c63ff';
    const option = createUserOption(userName, initial, color);
    userDropdown.insertBefore(option, separator || addBtn || null);
  });

  const savedName = String(preferredUser || '').trim();
  const nextOption = Array.from(userDropdown.querySelectorAll('.user-option[data-user]')).find((option) => option.dataset.user === savedName)
    || userDropdown.querySelector('.user-option[data-user]');

  if (!nextOption) {
    setNoSystemSelected();
    return;
  }

  document.querySelectorAll('.user-option[data-user]').forEach((option) => {
    option.classList.toggle('active', option === nextOption);
  });

  const nextUser = nextOption.dataset.user;
  const nextInitial = nextOption.dataset.initial || nextUser[0]?.toUpperCase() || '?';
  const nextColor = nextOption.dataset.color || systemProfiles[nextUser]?.color || '#6c63ff';
  const nextPhoto = systemProfiles[nextUser]?.profilePhoto || nextInitial;
  applyPhotoStyle(currentAvatar, nextPhoto, nextInitial, nextColor);
  if (currentUsername) currentUsername.textContent = nextUser;
  if (systemActiveAvatar) applyPhotoStyle(systemActiveAvatar, nextPhoto, nextInitial, nextColor);
  if (systemActiveName) systemActiveName.textContent = nextUser;
}

function renderSystemProfiles() {
  if (!systemProfilesGrid) return;

  let userOptions = Array.from(document.querySelectorAll('.user-option[data-user]'));
  const activeUser = currentUsername?.textContent?.trim();

  if (!userOptions.length && Object.keys(systemProfiles).length) {
    rebuildUserDropdownOptions(activeUser && activeUser !== NO_SYSTEM_USER ? activeUser : Object.keys(systemProfiles)[0]);
    userOptions = Array.from(document.querySelectorAll('.user-option[data-user]'));
  }

  if (!userOptions.length) {
    systemProfilesGrid.innerHTML = '<p class="headmate-hint" style="margin:0">No systems yet. Create one to start organizing headmates, locations, and other profiles.</p>';
    setNoSystemSelected();
    return;
  }

  const cardsHtml = userOptions.map((opt) => {
    const user = opt.dataset.user;
    const initial = opt.dataset.initial;
    const color = opt.dataset.color;
    ensureSystemProfile(user, initial, color);

    const profile = systemProfiles[user];
    const photo = profile.profilePhoto || initial;
    const hasPhotoUrl = isMediaUrl(photo);
    const banner = profile.banner || '';
    const hasBannerUrl = isMediaUrl(banner);
    const photoStyle = hasPhotoUrl
      ? `style="background-image:url('${escapeCssUrl(photo)}'); color:transparent; background-color:${profile.color}; background-size:cover; background-position:center; background-repeat:no-repeat;"`
      : `style="background-color:${profile.color};"`;
    const bannerStyle = hasBannerUrl
      ? `style="--profile-color:${profile.color}; background-image:linear-gradient(120deg, rgba(0,0,0,0.38), rgba(0,0,0,0.12)), url('${escapeCssUrl(banner)}'); background-size:cover; background-position:center; background-repeat:no-repeat;"`
      : `style="--profile-color:${profile.color}"`;

    let partnerKey = null;
    try {
      partnerKey = findPartnerKeyByLinkedSystemUser(user);
    } catch (_err) {
      partnerKey = null;
    }
    return `
      <article class="system-profile-card" data-system-user="${encodeURIComponent(user)}">
        <div class="system-profile-banner" ${bannerStyle} title="${escapeHtml(banner)}"></div>
        <div class="system-profile-content">
          <div class="system-profile-photo" ${photoStyle}>${hasPhotoUrl ? '' : escapeHtml(photo)}</div>
          <div class="system-profile-title">
            <h4>${escapeHtml(profile.name)}</h4>
            <div class="system-profile-description">${renderMarkdown(profile.description)}</div>
          </div>
          <div class="system-profile-fields">
            <div class="system-profile-field"><strong>Nickname</strong><span>${escapeHtml(profile.nickname)}</span></div>
            <div class="system-profile-field"><strong>Tags</strong><span>${escapeHtml(profile.tags || 'Not set')}</span></div>
            <div class="system-profile-field"><strong>Color</strong><span>${escapeHtml(profile.color)}</span></div>
            <div class="system-profile-field"><strong>Banner</strong><span>${escapeHtml(profile.banner)}</span></div>
            <div class="system-profile-field"><strong>Profile Photo</strong><span>${escapeHtml(photo)}</span></div>
          </div>
          <div class="system-profile-actions">
            <button class="btn-sm" type="button" data-system-action="switch" data-profile-user="${encodeURIComponent(user)}">${activeUser === user ? 'Active Account' : `Switch to ${escapeHtml(user)}`}</button>
            <button class="btn-sm" type="button" data-system-action="partner" data-profile-user="${encodeURIComponent(user)}">${partnerKey ? 'Open Partner' : 'Set as Partner'}</button>
            <button class="btn-sm" type="button" data-system-action="edit" data-profile-user="${encodeURIComponent(user)}">Edit</button>
            <button class="btn-sm" type="button" data-system-action="delete" data-profile-user="${encodeURIComponent(user)}">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  systemProfilesGrid.innerHTML = cardsHtml;
}

userSwitcherBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (typeof isSignedIn === 'function' && !isSignedIn()) {
    navigateTo('profile');
    return;
  }
  userDropdown.classList.toggle('open');
});

document.addEventListener('click', () => userDropdown.classList.remove('open'));

document.querySelectorAll('.user-option[data-user]').forEach(opt => {
  attachUserOptionClick(opt);
});

document.getElementById('addUserBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!canCreateSystemProfile(1)) return;
  const defaultName = `User ${document.querySelectorAll('.user-option[data-user]').length + 1}`;
  const name = safePrompt('Enter new user name:', defaultName);
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const initial = trimmed[0].toUpperCase();
  const colors = ['#6c63ff','#ff6584','#43d9ad','#f5a623','#a29bfe','#fd79a8','#0984e3','#e17055'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const shouldMigrateUnassigned = (currentUsername?.textContent || '').trim() === NO_SYSTEM_USER;

  const opt = createUserOption(trimmed, initial, color);
  ensureSystemProfile(trimmed, initial, color);
  if (shouldMigrateUnassigned) migrateUserScopedData(NO_SYSTEM_USER, trimmed);

  const addBtn = document.getElementById('addUserBtn');
  userDropdown.insertBefore(opt, addBtn || null);
  userDropdown.classList.remove('open');
  renderSystemProfiles();
  applyUserSelection(trimmed, initial, color, opt);
});

if (systemProfilesGrid) {
  systemProfilesGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-system-action]');
    if (!button) return;

    const action = button.dataset.systemAction;
    const user = decodeURIComponent(button.dataset.profileUser || '');
    const matchingOpt = document.querySelector(`.user-option[data-user="${user}"]`);

    if (action === 'switch') {
      if (!matchingOpt) return;
      applyUserSelection(
        matchingOpt.dataset.user,
        matchingOpt.dataset.initial,
        matchingOpt.dataset.color,
        matchingOpt
      );
      return;
    }

    if (action === 'partner') {
      const partnerKey = typeof upsertPartnerFromSystemUser === 'function' ? upsertPartnerFromSystemUser(user) : null;
      if (!partnerKey) return;
      openProfileFromLink('friends', partnerKey);
      return;
    }

    if (action === 'edit') {
      const profile = systemProfiles[user];
      if (!profile) return;
      editingSystemUser = user;
      creatingSystemProfile = false;
      systemEditName.value = profile.name;
      systemEditNickname.value = profile.nickname;
      systemEditDescription.value = profile.description;
      if (systemEditTags) systemEditTags.value = profile.tags || '';
      if (systemEditCustomFields) systemEditCustomFields.value = profile.customFields || '';
      systemEditColor.value = normalizeHexColor(profile.color, '#6c63ff');
      syncColorValuePill(systemEditColor);
      systemEditBanner.value = profile.banner;
      systemEditPhoto.value = profile.profilePhoto;
      if (systemEditTrustLevel) systemEditTrustLevel.value = profile.trustLevel || 'private';
      systemProfileEditor.hidden = false;
      systemProfileEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'delete') {
      if (!matchingOpt) return;
      if (!safeConfirm(`Delete profile for ${user}?`)) return;

      delete systemProfiles[user];
      migrateUserScopedData(user, NO_SYSTEM_USER);
      Object.values(partnerProfiles).forEach((partner) => {
        if (normalizeLookupName(partner.linkedSystemUser) === normalizeLookupName(user)) {
          partner.linkedSystemUser = 'Not set';
        }
      });
      matchingOpt.remove();

      const remainingOptions = Array.from(document.querySelectorAll('.user-option[data-user]'));
      if (!remainingOptions.length) {
        setNoSystemSelected();
        renderSystemProfiles();
        if (typeof renderHeadmatesTable === 'function') renderHeadmatesTable();
        return;
      }

      if (currentUsername.textContent === user) {
        const fallback = remainingOptions[0];
        applyUserSelection(
          fallback.dataset.user,
          fallback.dataset.initial,
          fallback.dataset.color,
          fallback
        );
      } else {
        renderSystemProfiles();
      }
    }
  });
}

if (addSystemProfileBtn) {
  addSystemProfileBtn.addEventListener('click', () => {
    if (!canCreateSystemProfile(1)) return;
    editingSystemUser = null;
    creatingSystemProfile = true;
    const defaultName = `Profile ${document.querySelectorAll('.user-option[data-user]').length + 1}`;
    systemEditName.value = defaultName;
    systemEditNickname.value = defaultName[0].toUpperCase();
    systemEditDescription.value = 'No description set.';
    if (systemEditTags) systemEditTags.value = 'Not set';
    if (systemEditCustomFields) systemEditCustomFields.value = 'Not set';
    systemEditColor.value = '#6c63ff';
    syncColorValuePill(systemEditColor);
    systemEditBanner.value = `${defaultName} Banner`;
    systemEditPhoto.value = defaultName[0].toUpperCase();
    if (systemEditTrustLevel) systemEditTrustLevel.value = 'private';
    systemProfileEditor.hidden = false;
    systemProfileEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (addSystemFromTemplateBtn) {
  addSystemFromTemplateBtn.addEventListener('click', () => {
    if (!canCreateSystemProfile(1)) return;
    const template = pickTemplateForTarget('system');
    if (!template) return;
    editingSystemUser = null;
    creatingSystemProfile = true;
    const fallbackName = `Profile ${document.querySelectorAll('.user-option[data-user]').length + 1}`;
    const templatedName = (template.name || '').trim() || fallbackName;
    systemEditName.value = templatedName;
    systemEditNickname.value = template.name?.[0]?.toUpperCase() || templatedName[0].toUpperCase();
    systemEditDescription.value = template.description || 'No description set.';
    if (systemEditTags) systemEditTags.value = template.category || 'Not set';
    if (systemEditCustomFields) systemEditCustomFields.value = template.defaultContent || 'Not set';
    systemEditColor.value = normalizeHexColor(template.color || '#6c63ff', '#6c63ff');
    syncColorValuePill(systemEditColor);
    systemEditBanner.value = template.banner || `${templatedName} Banner`;
    systemEditPhoto.value = template.profilePhoto || template.name?.[0]?.toUpperCase() || templatedName[0].toUpperCase();
    primeStoredMediaInput(systemEditBanner);
    primeStoredMediaInput(systemEditPhoto);
    systemProfileEditor.hidden = false;
    systemProfileEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (saveSystemEditorBtn) {
  saveSystemEditorBtn.addEventListener('click', () => {
    const newName = (systemEditName.value || '').trim();
    if (!newName) {
      safeAlert('Name is required.');
      return;
    }

    const draft = {
      name: newName,
      nickname: (systemEditNickname.value || '').trim() || newName[0].toUpperCase(),
      description: (systemEditDescription.value || '').trim() || 'No description set.',
      tags: (systemEditTags?.value || '').trim() || 'Not set',
      customFields: (systemEditCustomFields?.value || '').trim() || 'Not set',
      color: (systemEditColor.value || '').trim() || '#6c63ff',
      banner: getEditorInputValue(systemEditBanner) || `${newName} Banner`,
      profilePhoto: getEditorInputValue(systemEditPhoto) || newName[0].toUpperCase(),
      trustLevel: (systemEditTrustLevel?.value) || 'private'
    };

    const existingOpt = editingSystemUser
      ? document.querySelector(`.user-option[data-user="${editingSystemUser}"]`)
      : null;

    const duplicateOpt = Array.from(document.querySelectorAll('.user-option[data-user]'))
      .find((opt) => opt.dataset.user === newName && opt !== existingOpt);
    if (duplicateOpt) {
      safeAlert('A user with that name already exists.');
      return;
    }

    let option = existingOpt;
    if (!option) {
      if (!canCreateSystemProfile(1)) return;
      const addBtn = document.getElementById('addUserBtn');
      option = createUserOption(newName, newName[0].toUpperCase(), draft.color);
      if (addBtn) userDropdown.insertBefore(option, addBtn);
    }

    const previousName = editingSystemUser;
    if (previousName && previousName !== newName) {
      delete systemProfiles[previousName];
      migrateUserScopedData(previousName, newName);
      Object.values(partnerProfiles).forEach((partner) => {
        if (normalizeLookupName(partner.linkedSystemUser) === normalizeLookupName(previousName)) {
          partner.linkedSystemUser = newName;
          partner.linkedProfiles = String(partner.linkedProfiles || 'Not set').replaceAll(`System: ${previousName}`, `System: ${newName}`);
        }
      });
    }

    if (!previousName && (currentUsername?.textContent || '').trim() === NO_SYSTEM_USER) {
      migrateUserScopedData(NO_SYSTEM_USER, newName);
    }

    systemProfiles[newName] = draft;

    const initial = newName[0].toUpperCase();
    option.dataset.user = newName;
    option.dataset.initial = initial;
    option.dataset.color = draft.color;
    applyPhotoStyle(option.querySelector('.avatar'), draft.profilePhoto || initial, initial, draft.color);
    option.querySelector('span').textContent = newName;

    systemProfileEditor.hidden = true;
    editingSystemUser = null;
    creatingSystemProfile = false;

    renderSystemProfiles();
    applyUserSelection(newName, initial, draft.color, option);
  });
}

if (cancelSystemEditorBtn) {
  cancelSystemEditorBtn.addEventListener('click', () => {
    systemProfileEditor.hidden = true;
    editingSystemUser = null;
    creatingSystemProfile = false;
  });
}

renderSystemProfiles();

// =====================
// Chat: Inner Chat between alters
// =====================
const chatAlterList = document.getElementById('chatAlterList');
const chatConvoHeader = document.getElementById('chatConvoHeader');
const chatMessages = document.getElementById('chatMessages');
const chatInputBar = document.getElementById('chatInputBar');
const chatInput = document.getElementById('chatInput');
const sendMsg = document.getElementById('sendMsg');
const chatPollBtn = document.getElementById('chatPollBtn');

// Structure: { userName: { alterKey: [ {from:'me'|'alter', text, time} ] } }
const chatMessagesByUser = {};
let selectedChatAlterKey = null;

function ensureChatStore(userName, alterKey) {
  if (!chatMessagesByUser[userName]) chatMessagesByUser[userName] = {};
  if (!chatMessagesByUser[userName][alterKey]) chatMessagesByUser[userName][alterKey] = [];
  return chatMessagesByUser[userName][alterKey];
}

function getChatThread(alterKey) {
  const user = getActiveUserName();
  return ensureChatStore(user, alterKey);
}

function formatChatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderChatMessages() {
  if (!chatMessages) return;
  if (!selectedChatAlterKey) {
    chatMessages.innerHTML = '';
    return;
  }

  const thread = getChatThread(selectedChatAlterKey);
  const activeProfiles = getActiveHeadmateProfiles();
  const alter = activeProfiles[selectedChatAlterKey];
  const alterColor = alter?.color || '#6c63ff';
  const alterName = alter?.name || 'Alter';
  const activeUser = getActiveUserName();
  const selfProfile = systemProfiles[activeUser] || {};
  const selfName = selfProfile.name || activeUser;
  const selfColor = selfProfile.color || '#5865f2';
  const selfPhoto = selfProfile.profilePhoto || selfName[0]?.toUpperCase() || 'U';

  if (!thread.length) {
    chatMessages.innerHTML = `<div class="chat-no-messages">No messages yet. Say something!</div>`;
    return;
  }

  chatMessages.innerHTML = thread.map((msg) => {
    const isSelf = msg.from === 'me';
    const authorName = isSelf ? selfName : alterName;
    const avatarMarkup = renderAvatarMarkup(
      isSelf ? selfPhoto : (alter?.profilePhoto || alterName[0] || '?'),
      authorName[0] || '?',
      isSelf ? selfColor : alterColor,
      'sm'
    );

    if (msg.type === 'poll') {
      const voterKey = loggedInAccountKey || `user:${activeUser}`;
      const selectedOption = msg.votesByUser?.[voterKey] || '';
      const options = Array.isArray(msg.options) ? msg.options : [];
      const totalVotes = options.reduce((sum, option) => sum + Number(option.votes || 0), 0);

      return `<div class="msg ${isSelf ? 'sent' : 'received'}" data-message-id="${escapeHtml(msg.id || '')}">
        ${avatarMarkup}
        <div class="msg-body">
          <div class="msg-author-row"><strong>${escapeHtml(authorName)}</strong><span class="msg-time-inline">${formatChatTime(msg.ts)}</span></div>
          <div class="bubble poll-bubble">
            <div class="chat-poll-card" data-poll-message="${escapeHtml(msg.id || '')}">
              <p class="chat-poll-label">Poll</p>
              <div class="chat-poll-question">${renderMarkdown(msg.question || 'Untitled poll')}</div>
              <div class="chat-poll-options">
                ${options.map((option) => `
                  <button class="poll-option ${selectedOption === option.id ? 'active' : ''}" type="button" data-poll-message="${escapeHtml(msg.id || '')}" data-poll-option="${escapeHtml(option.id || '')}">
                    <span>${escapeHtml(option.label || 'Option')}</span>
                    <strong>${Number(option.votes || 0)}</strong>
                  </button>
                `).join('')}
              </div>
              <div class="chat-poll-total">${totalVotes} vote${totalVotes === 1 ? '' : 's'}</div>
            </div>
          </div>
        </div>
      </div>`;
    }

    return `<div class="msg ${isSelf ? 'sent' : 'received'}" data-message-id="${escapeHtml(msg.id || '')}">
      ${avatarMarkup}
      <div class="msg-body">
        <div class="msg-author-row"><strong>${escapeHtml(authorName)}</strong><span class="msg-time-inline">${formatChatTime(msg.ts)}</span></div>
        <div class="bubble">${renderMarkdown(msg.text || '')}</div>
      </div>
    </div>`;
  }).join('');

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function openChatWith(alterKey) {
  const activeProfiles = getActiveHeadmateProfiles();
  const alter = activeProfiles[alterKey];
  if (!alter) return;

  selectedChatAlterKey = alterKey;

  document.querySelectorAll('#chatAlterList .chat-item').forEach((li) => {
    li.classList.toggle('active', li.dataset.alterKey === alterKey);
  });

  const color = alter.color || '#6c63ff';
  chatConvoHeader.innerHTML = `
    ${renderAvatarMarkup(alter.profilePhoto || alter.name[0]?.toUpperCase() || '?', alter.name[0]?.toUpperCase() || '?', color)}
    <div class="chat-convo-header-info">
      <strong>${escapeHtml(alter.name)}</strong>
      <span>${escapeHtml(alter.mainRole || alter.pronouns || 'Alter')} • Markdown + polls enabled</span>
    </div>
  `;

  if (chatInputBar) chatInputBar.hidden = false;
  renderChatMessages();
}

function renderChatSidebar() {
  if (!chatAlterList) return;
  const activeProfiles = getActiveHeadmateProfiles();
  const entries = Object.entries(activeProfiles);

  if (!entries.length) {
    chatAlterList.innerHTML = '<li class="chat-empty-hint">No headmates for this user.</li>';
    selectedChatAlterKey = null;
    if (chatInputBar) chatInputBar.hidden = true;
    chatConvoHeader.innerHTML = '<span class="chat-placeholder-text">No alters found. Add headmates first.</span>';
    chatMessages.innerHTML = '';
    return;
  }

  const user = getActiveUserName();
  chatAlterList.innerHTML = entries.map(([key, alter]) => {
    const color = alter.color || '#6c63ff';
    const thread = (chatMessagesByUser[user]?.[key]) || [];
    const lastMsg = thread.length ? thread[thread.length - 1] : null;
    const previewText = !lastMsg
      ? 'No messages yet'
      : lastMsg.type === 'poll'
        ? `📊 ${lastMsg.question || 'Poll'}`
        : String(lastMsg.text || 'No message');
    const preview = escapeHtml(previewText.slice(0, 38)) + (previewText.length > 38 ? '…' : '');
    const isActive = selectedChatAlterKey === key;
    return `<li class="chat-item${isActive ? ' active' : ''}" data-alter-key="${key}">
      ${renderAvatarMarkup(alter.profilePhoto || alter.name[0]?.toUpperCase() || '?', alter.name[0]?.toUpperCase() || '?', color)}
      <div class="chat-item-meta">
        <strong>${escapeHtml(alter.name)}</strong>
        <small>${preview}</small>
      </div>
    </li>`;
  }).join('');

  if (selectedChatAlterKey && !activeProfiles[selectedChatAlterKey]) {
    selectedChatAlterKey = null;
    if (chatInputBar) chatInputBar.hidden = true;
    chatConvoHeader.innerHTML = '<span class="chat-placeholder-text">Select an alter to open a conversation.</span>';
    chatMessages.innerHTML = '';
  }
}

if (chatAlterList) {
  chatAlterList.addEventListener('click', (e) => {
    const li = e.target.closest('[data-alter-key]');
    if (!li) return;
    openChatWith(li.dataset.alterKey);
  });
}

function sendChatMessage() {
  if (!chatInput || !selectedChatAlterKey) return;
  const text = chatInput.value.trim();
  if (!text) return;
  const thread = getChatThread(selectedChatAlterKey);
  thread.push({
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type: 'text',
    from: 'me',
    text,
    ts: Date.now()
  });
  chatInput.value = '';
  renderChatMessages();
  renderChatSidebar();
}

function createChatPoll() {
  if (!selectedChatAlterKey) {
    safeAlert('Open a conversation first.');
    return;
  }

  const question = safePrompt('Poll question:', 'What should we focus on next?');
  if (!question || !question.trim()) return;

  const rawOptions = safePrompt('Enter 2 or more options, separated by commas:', 'Rest, Journal, Gaming');
  if (!rawOptions || !rawOptions.trim()) return;

  const options = rawOptions
    .split(',')
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((label, index) => ({ id: `opt-${index + 1}`, label, votes: 0 }));

  if (options.length < 2) {
    safeAlert('Please include at least two options for the poll.');
    return;
  }

  const thread = getChatThread(selectedChatAlterKey);
  thread.push({
    id: `poll-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type: 'poll',
    from: 'me',
    question: question.trim(),
    options,
    votesByUser: {},
    ts: Date.now()
  });

  renderChatMessages();
  renderChatSidebar();
}

function voteOnChatPoll(messageId, optionId) {
  if (!selectedChatAlterKey || !messageId || !optionId) return;
  const thread = getChatThread(selectedChatAlterKey);
  const message = thread.find((entry) => entry.id === messageId && entry.type === 'poll');
  if (!message || !Array.isArray(message.options)) return;

  const voterKey = loggedInAccountKey || `user:${getActiveUserName()}`;
  const previousOptionId = message.votesByUser?.[voterKey];
  if (!message.votesByUser) message.votesByUser = {};

  if (previousOptionId && previousOptionId !== optionId) {
    const previousOption = message.options.find((option) => option.id === previousOptionId);
    if (previousOption) previousOption.votes = Math.max(0, Number(previousOption.votes || 0) - 1);
  }

  if (previousOptionId === optionId) {
    const sameOption = message.options.find((option) => option.id === optionId);
    if (sameOption) sameOption.votes = Math.max(0, Number(sameOption.votes || 0) - 1);
    delete message.votesByUser[voterKey];
  } else {
    const nextOption = message.options.find((option) => option.id === optionId);
    if (!nextOption) return;
    nextOption.votes = Number(nextOption.votes || 0) + 1;
    message.votesByUser[voterKey] = optionId;
  }

  renderChatMessages();
  renderChatSidebar();
}

if (sendMsg) sendMsg.addEventListener('click', sendChatMessage);
if (chatPollBtn) chatPollBtn.addEventListener('click', createChatPoll);
if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
}
if (chatMessages) {
  chatMessages.addEventListener('click', (event) => {
    const pollButton = event.target.closest('[data-poll-message][data-poll-option]');
    if (!pollButton) return;
    voteOnChatPoll(pollButton.dataset.pollMessage, pollButton.dataset.pollOption);
  });
}

// =====================
// Messages: Direct messages between account friends
// =====================
const messagesFriendSelect = document.getElementById('messagesFriendSelect');
const messagesTableBody = document.getElementById('messagesTableBody');
const directMessagesHeader = document.getElementById('directMessagesHeader');
const directMessagesList = document.getElementById('directMessagesList');
const directMessageInputBar = document.getElementById('directMessageInputBar');
const directMessageInput = document.getElementById('directMessageInput');
const sendDirectMessageBtn = document.getElementById('sendDirectMessageBtn');
const openFriendsTabFromMessagesBtn = document.getElementById('openFriendsTabFromMessagesBtn');

const directMessagesByAccount = {};
let selectedDirectMessageFriend = '';

function ensureDirectMessageAccountStore(accountUsername = loggedInAccountKey || '') {
  const cleanAccount = String(accountUsername || '').trim().toLowerCase();
  if (!cleanAccount) return {};
  if (!directMessagesByAccount[cleanAccount]) directMessagesByAccount[cleanAccount] = {};
  return directMessagesByAccount[cleanAccount];
}

function getDirectMessageThread(friendUsername, accountUsername = loggedInAccountKey || '') {
  const cleanFriend = String(friendUsername || '').trim().toLowerCase();
  if (!cleanFriend) return [];
  const store = ensureDirectMessageAccountStore(accountUsername);
  if (!store[cleanFriend]) store[cleanFriend] = [];
  return store[cleanFriend];
}

function formatDirectMessageTime(ts, compact = false) {
  if (!ts) return '—';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return compact
    ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function markDirectMessagesRead(friendUsername = '') {
  const account = getCurrentAccountRecord();
  if (!account) return false;

  let changed = false;
  getDirectMessageThread(friendUsername, account.username).forEach((message) => {
    if (message.direction === 'incoming' && !message.read) {
      message.read = true;
      changed = true;
    }
  });

  return changed;
}

function openDirectMessagesWith(friendUsername = '') {
  const cleanFriend = String(friendUsername || '').trim().toLowerCase();
  selectedDirectMessageFriend = cleanFriend;
  const changed = cleanFriend ? markDirectMessagesRead(cleanFriend) : false;
  renderMessagesModule();
  if (changed) scheduleHubStatePersist();
}

function renderMessagesModule() {
  if (!messagesTableBody || !directMessagesHeader || !directMessagesList || !messagesFriendSelect) return;

  const account = getCurrentAccountRecord();
  if (!account) {
    messagesFriendSelect.innerHTML = '<option value="">Select a friend</option>';
    messagesTableBody.innerHTML = '<tr><td colspan="4" class="empty-state-cell">Sign in to message your friends.</td></tr>';
    directMessagesHeader.innerHTML = '<span class="chat-placeholder-text">Sign in to open a friend conversation.</span>';
    directMessagesList.innerHTML = '<div class="chat-no-messages">Messages are available after sign-in.</div>';
    if (directMessageInputBar) directMessageInputBar.hidden = true;
    return;
  }

  const friendEntries = getAccountFriendEntries(account)
    .sort((a, b) => String(a.name || a.username).localeCompare(String(b.name || b.username)));

  if (!friendEntries.length) {
    selectedDirectMessageFriend = '';
    messagesFriendSelect.innerHTML = '<option value="">Select a friend</option>';
    messagesTableBody.innerHTML = '<tr><td colspan="4" class="empty-state-cell">Add at least one friend to start messaging.</td></tr>';
    directMessagesHeader.innerHTML = '<span class="chat-placeholder-text">Select a friend to open a conversation.</span>';
    directMessagesList.innerHTML = '<div class="chat-no-messages">Messages are reserved for your account friends.</div>';
    if (directMessageInputBar) directMessageInputBar.hidden = true;
    return;
  }

  const summaries = friendEntries.map((entry) => {
    const thread = getDirectMessageThread(entry.username, account.username);
    const lastMessage = thread.length ? thread[thread.length - 1] : null;
    const unreadCount = thread.filter((message) => message.direction === 'incoming' && !message.read).length;
    return {
      ...entry,
      thread,
      lastMessage,
      unreadCount
    };
  }).sort((a, b) => (Number(b.lastMessage?.ts || 0) - Number(a.lastMessage?.ts || 0)) || String(a.name || a.username).localeCompare(String(b.name || b.username)));

  if (!summaries.some((entry) => entry.username === selectedDirectMessageFriend)) {
    selectedDirectMessageFriend = summaries[0]?.username || '';
  }

  messagesFriendSelect.innerHTML = summaries.map((entry) => `
    <option value="${escapeHtml(entry.username)}"${selectedDirectMessageFriend === entry.username ? ' selected' : ''}>${escapeHtml(entry.name)} (@${escapeHtml(entry.username)})</option>
  `).join('');

  messagesTableBody.innerHTML = summaries.map((entry) => {
    const previewRaw = entry.lastMessage ? String(entry.lastMessage.text || 'No message') : 'No messages yet.';
    const preview = truncatePreview(previewRaw, 56);
    const statusMarkup = entry.unreadCount
      ? `<span class="badge green">${entry.unreadCount} unread</span>`
      : '<span class="badge">Ready</span>';
    return `
      <tr data-message-friend="${escapeHtml(entry.username)}" class="${selectedDirectMessageFriend === entry.username ? 'selected' : ''}">
        <td>${escapeHtml(entry.name)}</td>
        <td>${escapeHtml(preview)}</td>
        <td>${escapeHtml(entry.lastMessage ? formatDirectMessageTime(entry.lastMessage.ts, true) : '—')}</td>
        <td>${statusMarkup}</td>
      </tr>
    `;
  }).join('');

  const activeFriend = summaries.find((entry) => entry.username === selectedDirectMessageFriend) || summaries[0];
  if (!activeFriend) {
    directMessagesHeader.innerHTML = '<span class="chat-placeholder-text">Select a friend to open a conversation.</span>';
    directMessagesList.innerHTML = '<div class="chat-no-messages">No friend messages yet.</div>';
    if (directMessageInputBar) directMessageInputBar.hidden = true;
    return;
  }

  selectedDirectMessageFriend = activeFriend.username;
  directMessagesHeader.innerHTML = `
    ${renderAvatarMarkup(activeFriend.profilePhoto || activeFriend.name[0]?.toUpperCase() || '?', activeFriend.name[0]?.toUpperCase() || '?', activeFriend.color || '#6c63ff')}
    <div class="chat-convo-header-info">
      <strong>${escapeHtml(activeFriend.name)}</strong>
      <span>@${escapeHtml(activeFriend.username)} • ${escapeHtml(activeFriend.trustLevel || 'friends')} friend</span>
    </div>
  `;

  if (!activeFriend.thread.length) {
    directMessagesList.innerHTML = `<div class="chat-no-messages">No messages with @${escapeHtml(activeFriend.username)} yet. Send the first one below.</div>`;
  } else {
    const accountName = account.name || account.username || 'You';
    const accountPhoto = account.profilePhoto || accountName[0]?.toUpperCase() || 'U';
    const accountColor = account.color || '#6c63ff';
    directMessagesList.innerHTML = activeFriend.thread.map((message) => {
      const isSelf = message.direction !== 'incoming';
      const authorName = isSelf ? accountName : activeFriend.name;
      const avatarMarkup = renderAvatarMarkup(
        isSelf ? accountPhoto : (activeFriend.profilePhoto || activeFriend.name[0]?.toUpperCase() || '?'),
        authorName[0]?.toUpperCase() || '?',
        isSelf ? accountColor : (activeFriend.color || '#6c63ff'),
        'sm'
      );
      return `
        <div class="msg ${isSelf ? 'sent' : 'received'}" data-direct-message-id="${escapeHtml(message.id || '')}">
          ${avatarMarkup}
          <div class="msg-body">
            <div class="msg-author-row"><strong>${escapeHtml(authorName)}</strong><span class="msg-time-inline">${escapeHtml(formatDirectMessageTime(message.ts))}</span></div>
            <div class="bubble">${renderMarkdown(message.text || '')}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (directMessageInputBar) directMessageInputBar.hidden = false;
  if (directMessageInput) directMessageInput.placeholder = `Send a message to @${activeFriend.username}...`;
  directMessagesList.scrollTop = directMessagesList.scrollHeight;
}

function sendDirectMessage() {
  const account = getCurrentAccountRecord();
  if (!account || !directMessageInput) return;

  const friendUsername = String(selectedDirectMessageFriend || messagesFriendSelect?.value || '').trim().toLowerCase();
  const text = directMessageInput.value.trim();
  if (!friendUsername) {
    safeAlert('Select one of your friends first.');
    return;
  }
  if (!text) return;

  const friendEntry = getAccountFriendEntries(account).find((entry) => entry.username === friendUsername);
  if (!friendEntry) {
    safeAlert('Messages can only be sent to people in your friends list.');
    return;
  }

  const timestamp = Date.now();
  const thread = getDirectMessageThread(friendUsername, account.username);
  thread.push({
    id: `dm-${timestamp}-${Math.floor(Math.random() * 10000)}`,
    direction: 'outgoing',
    from: account.username,
    to: friendUsername,
    text,
    read: true,
    ts: timestamp
  });

  if (!USE_BACKEND_AUTH && accounts[friendUsername]) {
    const friendThread = getDirectMessageThread(account.username, friendUsername);
    friendThread.push({
      id: `dm-${timestamp}-${Math.floor(Math.random() * 10000)}`,
      direction: 'incoming',
      from: account.username,
      to: friendUsername,
      text,
      read: false,
      ts: timestamp
    });
  }

  directMessageInput.value = '';
  renderMessagesModule();
  scheduleHubStatePersist();
}

if (messagesTableBody) {
  messagesTableBody.addEventListener('click', (event) => {
    const row = event.target.closest('[data-message-friend]');
    if (!row) return;
    openDirectMessagesWith(row.dataset.messageFriend || '');
  });
}

if (messagesFriendSelect) {
  messagesFriendSelect.addEventListener('change', () => {
    openDirectMessagesWith(messagesFriendSelect.value || '');
  });
}

if (sendDirectMessageBtn) sendDirectMessageBtn.addEventListener('click', sendDirectMessage);
if (directMessageInput) {
  directMessageInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    sendDirectMessage();
  });
}

if (openFriendsTabFromMessagesBtn) {
  openFriendsTabFromMessagesBtn.addEventListener('click', () => {
    navigateTo('accountFriends');
  });
}

// =====================
// Partners: Global Profile Manager
// =====================
const partnersTableBody = document.getElementById('partnersTableBody');
const partnerProfile = document.getElementById('partnerProfile');
const partnerBanner = document.getElementById('partnerBanner');
const partnerPhoto = document.getElementById('partnerPhoto');
const partnerName = document.getElementById('partnerName');
const partnerMeta = document.getElementById('partnerMeta');
const partnerProfileGrid = document.getElementById('partnerProfileGrid');
const addPartnerBtn = document.getElementById('addPartnerBtn');
const addPartnerFromTemplateBtn = document.getElementById('addPartnerFromTemplateBtn');
const editPartnerBtn = document.getElementById('editPartnerBtn');
const linkPartnerAccountBtn = document.getElementById('linkPartnerAccountBtn');
const linkPartnerAlterBtn = document.getElementById('linkPartnerAlterBtn');
const linkPartnerConnectionBtn = document.getElementById('linkPartnerConnectionBtn');
const linkPartnerProfileBtn = document.getElementById('linkPartnerProfileBtn');
const addPartnerHeadmateBtn = document.getElementById('addPartnerHeadmateBtn');
const savePartnerBtn = document.getElementById('savePartnerBtn');
const deletePartnerBtn = document.getElementById('deletePartnerBtn');
const partnerEditor = document.getElementById('partnerEditor');
const partnerEditorFields = document.getElementById('partnerEditorFields');
const partnerHeadmatesList = document.getElementById('partnerHeadmatesList');
const partnersDiagramCanvas = document.getElementById('partnersDiagramCanvas');
const partnersDiagramRefreshBtn = document.getElementById('partnersDiagramRefreshBtn');
const addInnerRelationshipBtn = document.getElementById('addInnerRelationshipBtn');
const innerRelationshipList = document.getElementById('innerRelationshipList');

const partnerFieldSchema = [
  { key: 'name', label: 'Name' },
  { key: 'connections', label: 'Connections (comma separated)' },
  { key: 'linkedSystemUser', label: 'Linked system account' },
  { key: 'linkedAlters', label: 'Linked alters' },
  { key: 'partnerHeadmates', label: 'Their headmates' },
  { key: 'linkedProfiles', label: 'Linked profiles' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'tags', label: 'Tags' },
  { key: 'customFields', label: 'Custom fields', type: 'textarea' },
  { key: 'relationshipType', label: 'Relationship type' },
  { key: 'profilePhoto', label: 'Profile photo' },
  { key: 'banner', label: 'Banner' },
  { key: 'color', label: 'Color' }
];

const partnerProfiles = {};

let selectedPartnerKey = null;
let creatingPartner = false;

function findPartnerKeyByLinkedSystemUser(userName) {
  const normalized = normalizeLookupName(userName);
  return Object.entries(partnerProfiles).find(([, profile]) => normalizeLookupName(profile.linkedSystemUser) === normalized)?.[0] || null;
}

function syncPartnerWithSystemUser(profile, userName) {
  const systemProfile = systemProfiles[userName];
  if (!profile || !systemProfile) return profile;
  profile.linkedSystemUser = userName;
  profile.relationshipType = profile.relationshipType && profile.relationshipType !== 'Not set' ? profile.relationshipType : 'System Partner';
  if (!profile.description || profile.description === 'Not set') profile.description = systemProfile.description || 'Linked system account.';
  if (!profile.profilePhoto || profile.profilePhoto === 'P') profile.profilePhoto = systemProfile.profilePhoto || profile.profilePhoto;
  if (!profile.banner || profile.banner === `${profile.name} Banner`) profile.banner = systemProfile.banner || profile.banner;
  if (!profile.color || profile.color === '#6c63ff') profile.color = systemProfile.color || profile.color;
  profile.linkedProfiles = appendCommaLinkValue(profile.linkedProfiles, `System: ${userName}`);
  return profile;
}

function upsertPartnerFromSystemUser(userName) {
  const systemProfile = systemProfiles[userName];
  if (!systemProfile) return null;

  const existingKey = findPartnerKeyByLinkedSystemUser(userName) || findPartnerKeyByName(systemProfile.name);
  if (existingKey && partnerProfiles[existingKey]) {
    syncPartnerWithSystemUser(partnerProfiles[existingKey], userName);
    return existingKey;
  }

  const baseKey = userName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `partner-${Date.now()}`;
  let key = baseKey;
  let suffix = 2;
  while (partnerProfiles[key]) {
    key = `${baseKey}-${suffix}`;
    suffix += 1;
  }

  partnerProfiles[key] = syncPartnerWithSystemUser(createDefaultPartnerProfile(systemProfile.name || userName), userName);
  partnerProfiles[key].name = systemProfile.name || userName;
  return key;
}

function createDefaultPartnerProfile(name) {
  const initial = name[0]?.toUpperCase() || 'P';
  return {
    name,
    connections: 'Not set',
    linkedSystemUser: 'Not set',
    linkedAlters: 'Not set',
    partnerHeadmates: 'Not set',
    linkedProfiles: 'Not set',
    description: 'Not set',
    tags: 'Not set',
    customFields: 'Not set',
    relationshipType: 'Romantic',
    profilePhoto: initial,
    banner: `${name} Banner`,
    color: '#6c63ff'
  };
}

function renderPartnerEditorFields(profile) {
  if (!partnerEditorFields) return;
  const fp = profile.fieldPrivacy || {};
  partnerEditorFields.innerHTML = partnerFieldSchema.map((field) => {
    const id = `partnerEdit_${field.key}`;
    const safeValue = String(profile[field.key] ?? '');
    const privSel = renderPrivacySelect(`priv_partnerEdit_${field.key}`, fp[field.key] || 'public');
    const inputHtml = renderFieldInput(field, id, safeValue);
    return `<div class="editor-field-row">${inputHtml}${privSel}</div>`;
  }).join('');

  bindColorPickers(partnerEditorFields);
  bindAutoGrowingTextareas(partnerEditorFields);
}

function readPartnerEditorValues(baseProfile) {
  const updated = { ...baseProfile };
  partnerFieldSchema.forEach((field) => {
    const input = document.getElementById(`partnerEdit_${field.key}`);
    if (!input) return;
    const value = getEditorInputValue(input);
    updated[field.key] = value || (baseProfile[field.key] ?? 'Not set');
  });
  updated.fieldPrivacy = readFieldPrivacy(partnerFieldSchema, 'partnerEdit', baseProfile);
  return updated;
}

function renderPartnerProfile(profile) {
  if (!partnerProfile || !partnerProfileGrid) return;
  const partnerPhotoValue = profile.profilePhoto || 'P';
  applyPhotoStyle(partnerPhoto, partnerPhotoValue, profile.name?.[0] || 'P', profile.color || '#6c63ff');
  const linkedAlterCount = parseLinkedTextList(profile.linkedAlters).length;
  const linkedUserRaw = String(profile.linkedSystemUser || '').trim();
  const linkedUser = findSystemUserByName(linkedUserRaw || '');
  const linkedUserValid = Boolean(linkedUser);
  const accountHeadmateCount = linkedUserValid ? Object.keys(ensureHeadmateStoreForUser(linkedUser)).length : 0;
  const partnerHeadmateCount = parsePartnerHeadmateEntries(profile).length + accountHeadmateCount;
  partnerName.textContent = profile.name;
  partnerMeta.textContent = `${profile.relationshipType || 'Unspecified'}${linkedUserValid ? ` • ${linkedUser}` : ''} • ${linkedAlterCount} linked alter${linkedAlterCount === 1 ? '' : 's'} • ${partnerHeadmateCount} ${getTermCountLabel('headmates', partnerHeadmateCount).toLowerCase()}`;
  applyBannerStyle(partnerBanner, profile.banner, profile.color || '#6c63ff', '--headmate-color');

  const fp2 = profile.fieldPrivacy || {};
  const viewerLevel2 = getViewerTrustLevel();
  const basePartnerFields = partnerFieldSchema
    .filter((field) => field.key !== 'customFields' && canViewField(fp2[field.key] || 'public', viewerLevel2))
    .map((field) => {
      const value = renderProfileFieldValue('partner', field, profile);
      const badge = privacyBadge(fp2[field.key]);
      return `<article class="headmate-field"><span class="headmate-field-label">${escapeHtml(field.label)}${badge}</span><div class="headmate-field-value">${value}</div></article>`;
    });
  const partnerCustomFields = canViewField(fp2.customFields || 'public', viewerLevel2)
    ? renderCustomFieldArticles(profile, fp2.customFields || 'public')
    : [];
  partnerProfileGrid.innerHTML = basePartnerFields.concat(partnerCustomFields).join('');

  renderPartnerHeadmates(profile);
  partnerProfile.hidden = false;
}

function parsePartnerList(profile) {
  return parseLinkedTextList(profile?.connections);
}

function parsePartnerHeadmateEntries(profile) {
  return parseLinkedTextList(profile?.partnerHeadmates).map((entry) => {
    const match = entry.match(/^(.+?)\s*\((.+)\)$/);
    return match
      ? { raw: entry, name: match[1].trim(), role: match[2].trim() }
      : { raw: entry, name: entry.trim(), role: 'Headmate' };
  });
}

function getInnerSystemRelationshipEntries(userName = getActiveUserName()) {
  if (!userName || userName === NO_SYSTEM_USER) return [];

  const profiles = ensureHeadmateStoreForUser(userName);
  const records = Object.entries(profiles || {});
  const relationships = [];
  const seenPairs = new Set();

  records.forEach(([key, headmate]) => {
    const headmateName = String(headmate?.name || key).trim();
    if (!headmateName) return;

    parseLinkedTextList(headmate?.partners).forEach((partnerName) => {
      const match = records.find(([candidateKey, candidateProfile]) => (
        candidateKey !== key
        && (
          normalizeLookupName(candidateKey) === normalizeLookupName(partnerName)
          || normalizeLookupName(candidateProfile?.name) === normalizeLookupName(partnerName)
        )
      ));

      if (!match) return;

      const [otherKey, otherHeadmate] = match;
      const pairKey = [key, otherKey].sort().join('|');
      if (seenPairs.has(pairKey)) return;
      seenPairs.add(pairKey);

      const statuses = [headmate?.partnershipStatus, otherHeadmate?.partnershipStatus]
        .map((value) => String(value || '').trim())
        .filter((value) => value && !['not set', 'none', 'n/a', 'single', 'unpartnered'].includes(value.toLowerCase()));

      relationships.push({
        pairKey,
        left: {
          key,
          name: headmateName,
          photo: headmate?.profilePhoto || headmateName[0]?.toUpperCase() || 'H',
          color: headmate?.color || '#6c63ff',
          meta: headmate?.mainRole || headmate?.pronouns || 'Headmate'
        },
        right: {
          key: otherKey,
          name: String(otherHeadmate?.name || otherKey).trim() || otherKey,
          photo: otherHeadmate?.profilePhoto || String(otherHeadmate?.name || otherKey)[0]?.toUpperCase() || 'H',
          color: otherHeadmate?.color || '#ff6584',
          meta: otherHeadmate?.mainRole || otherHeadmate?.pronouns || 'Headmate'
        },
        status: statuses.length > 1 && statuses[0] !== statuses[1]
          ? `${statuses[0]} / ${statuses[1]}`
          : (statuses[0] || 'Linked relationship')
      });
    });
  });

  return relationships.sort((a, b) => `${a.left.name} ${a.right.name}`.localeCompare(`${b.left.name} ${b.right.name}`));
}

function renderInnerSystemRelationships() {
  if (!innerRelationshipList) return;

  const activeUser = getActiveUserName();
  if (!activeUser || activeUser === NO_SYSTEM_USER) {
    innerRelationshipList.innerHTML = '<p class="headmate-hint" style="margin:8px 0">Select or create a system first to track inner-system relationships here.</p>';
    return;
  }

  const entries = getInnerSystemRelationshipEntries(activeUser);
  if (!entries.length) {
    innerRelationshipList.innerHTML = `<p class="headmate-hint" style="margin:8px 0">No inner-system relationships linked for ${escapeHtml(activeUser)} yet. Use “Link Headmates” to add one.</p>`;
    return;
  }

  innerRelationshipList.innerHTML = entries.map((entry) => `
    <article class="account-friend-card" data-inner-relationship="${escapeHtml(entry.pairKey)}">
      <div class="account-friend-main">
        <div style="display:flex;gap:.35rem;align-items:center">
          ${renderAvatarMarkup(entry.left.photo, entry.left.name[0]?.toUpperCase() || 'H', entry.left.color || '#6c63ff', 'sm')}
          ${renderAvatarMarkup(entry.right.photo, entry.right.name[0]?.toUpperCase() || 'H', entry.right.color || '#ff6584', 'sm')}
        </div>
        <div class="account-friend-meta">
          <strong>${escapeHtml(entry.left.name)} ↔ ${escapeHtml(entry.right.name)}</strong>
          <span>${escapeHtml(entry.status)} • In-system relationship</span>
          <span>${escapeHtml(entry.left.meta)} / ${escapeHtml(entry.right.meta)}</span>
        </div>
      </div>
      <div class="account-friend-actions">
        <button class="btn-sm" type="button" data-open-inner-headmate="${escapeHtml(entry.left.key)}">Open ${escapeHtml(entry.left.name)}</button>
        <button class="btn-sm" type="button" data-open-inner-headmate="${escapeHtml(entry.right.key)}">Open ${escapeHtml(entry.right.name)}</button>
        <button class="btn-sm subsystem-unlink-btn" type="button" data-remove-inner-relationship="${escapeHtml(entry.pairKey)}">Remove</button>
      </div>
    </article>
  `).join('');
}

function renderPartnerHeadmates(profile) {
  if (!partnerHeadmatesList) return;
  const entries = parsePartnerHeadmateEntries(profile);
  const linkedUser = findSystemUserByName(String(profile.linkedSystemUser || '').trim());
  const linkedUserValid = Boolean(linkedUser);
  const accountHeadmates = linkedUserValid
    ? Object.entries(ensureHeadmateStoreForUser(linkedUser)).map(([key, headmate]) => ({ key, headmate }))
    : [];

  if (!entries.length && !accountHeadmates.length) {
    partnerHeadmatesList.innerHTML = `<p class="headmate-hint" style="margin:8px 0">No partner ${escapeHtml(getTermLabel('headmates').toLowerCase())} added yet.</p>`;
    return;
  }

  const linkedAccountMarkup = linkedUserValid
    ? `
      <div class="subsystem-hub-member">
        ${renderAvatarMarkup(systemProfiles[linkedUser]?.profilePhoto || linkedUser[0]?.toUpperCase() || 'A', linkedUser[0]?.toUpperCase() || 'A', systemProfiles[linkedUser]?.color || profile.color || '#6c63ff', 'sm')}
        <div class="subsystem-hub-member-info">
          <strong>${escapeHtml(linkedUser)}</strong>
          <span>Showing logged headmates from this account</span>
        </div>
      </div>
    `
    : '';

  const accountHeadmateMarkup = accountHeadmates.map(({ key, headmate }) => {
    return `
      <div class="subsystem-hub-member" data-partner-account-user="${escapeHtml(linkedUser)}" data-partner-account-headmate="${key}" title="Open full profile">
        ${renderAvatarMarkup(headmate.profilePhoto || headmate.name?.[0]?.toUpperCase() || 'H', headmate.name?.[0]?.toUpperCase() || 'H', headmate.color || '#6c63ff', 'sm')}
        <div class="subsystem-hub-member-info">
          <strong>${escapeHtml(headmate.name || key)}</strong>
          <span>${escapeHtml(headmate.mainRole || headmate.pronouns || 'Headmate')} • Open full profile</span>
        </div>
      </div>
    `;
  }).join('');

  const customHeadmateMarkup = entries.map((entry) => {
    const initial = entry.name[0]?.toUpperCase() || 'H';
    return `
      <div class="subsystem-hub-member" data-partner-headmate="${escapeHtml(entry.name)}" title="Open full profile if one exists">
        <div class="headmate-photo sm" style="background:${profile.color || '#6c63ff'}">${escapeHtml(initial)}</div>
        <div class="subsystem-hub-member-info">
          <strong>${escapeHtml(entry.name)}</strong>
          <span>${escapeHtml(entry.role || 'Headmate')} • Open full profile</span>
        </div>
        <button class="btn-sm subsystem-unlink-btn" type="button" data-remove-partner-headmate="${escapeHtml(entry.raw)}" title="Remove">&#10005;</button>
      </div>
    `;
  }).join('');

  partnerHeadmatesList.innerHTML = `${linkedAccountMarkup}${accountHeadmateMarkup}${customHeadmateMarkup}`;
}

function openPartnerHeadmateProfile(profile, headmateNameOrKey, userNameHint = '') {
  if (!profile || !headmateNameOrKey) return;

  const linkedUser = findSystemUserByName(userNameHint || String(profile.linkedSystemUser || '').trim());
  let targetUser = linkedUser;
  let headmateKey = null;

  if (linkedUser) {
    const linkedProfiles = ensureHeadmateStoreForUser(linkedUser);
    headmateKey = linkedProfiles[headmateNameOrKey]
      ? headmateNameOrKey
      : Object.entries(linkedProfiles).find(([key, headmate]) => (
        normalizeLookupName(key) === normalizeLookupName(headmateNameOrKey)
        || normalizeLookupName(headmate.name) === normalizeLookupName(headmateNameOrKey)
      ))?.[0] || null;
  }

  if (!headmateKey) {
    targetUser = getActiveUserName();
    headmateKey = findHeadmateKeyByName(headmateNameOrKey);
  }

  if (!headmateKey) {
    safeAlert('No full headmate profile was found for that entry yet.');
    return;
  }

  const userOption = Array.from(document.querySelectorAll('.user-option[data-user]')).find((opt) => opt.dataset.user === targetUser);
  if (userOption && currentUsername.textContent !== targetUser) {
    applyUserSelection(userOption.dataset.user, userOption.dataset.initial, userOption.dataset.color, userOption);
  }

  openProfileFromLink('parts', headmateKey);
}

function renderPartnersDiagram() {
  if (!partnersDiagramCanvas) return;

  const entries = Object.entries(partnerProfiles)
    .filter(([, profile]) => String(profile?.name || '').trim());

  if (!entries.length) {
    partnersDiagramCanvas.innerHTML = '<div class="headmate-hint" style="padding:14px">Add partners to generate the diagram.</div>';
    return;
  }

  const width = Math.max(680, partnersDiagramCanvas.clientWidth || 680);
  const ringCapacities = [];
  let remaining = entries.length;
  let ringIndex = 0;
  while (remaining > 0) {
    const capacity = 6 + ringIndex * 4;
    ringCapacities.push(Math.min(capacity, remaining));
    remaining -= capacity;
    ringIndex += 1;
  }

  const ringCount = ringCapacities.length;
  const height = Math.max(400, 320 + Math.max(0, ringCount - 1) * 108);
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.max(112, Math.min(width / 2 - 94, height / 2 - 82));
  const baseRadius = ringCount > 1
    ? Math.max(104, maxRadius - (ringCount - 1) * 84)
    : Math.max(112, Math.min(maxRadius, 136));
  const radiusStep = ringCount > 1
    ? Math.max(74, Math.min(96, (maxRadius - baseRadius) / Math.max(1, ringCount - 1)))
    : 0;
  const activeSystem = systemProfiles[getActiveUserName()] || {};
  const palette = ['#6c63ff', '#ff6584', '#43d9ad', '#f5a623', '#0984e3', '#e17055', '#a29bfe', '#00b894'];
  const selfNode = {
    key: '__self__',
    name: activeSystem.name || 'You',
    type: 'Center',
    color: normalizeHexColor(activeSystem.color || '#6c63ff', '#6c63ff'),
    x: centerX,
    y: centerY
  };

  const nodes = [];
  let entryCursor = 0;

  ringCapacities.forEach((count, currentRing) => {
    const radius = ringCount === 1
      ? baseRadius
      : Math.min(maxRadius, baseRadius + currentRing * radiusStep);

    for (let offset = 0; offset < count; offset += 1) {
      const [key, profile] = entries[entryCursor];
      const angle = (Math.PI * 2 * offset) / count - Math.PI / 2 + (currentRing % 2 ? Math.PI / Math.max(count, 2) : 0);
      const fallbackColor = palette[entryCursor % palette.length];
      const fullName = String(profile.name || key).trim();

      nodes.push({
        key,
        name: fullName,
        shortName: fullName.length > 18 ? `${fullName.slice(0, 15)}…` : fullName,
        type: profile.relationshipType || 'Unspecified',
        color: normalizeHexColor(profile.color || fallbackColor, fallbackColor),
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });

      entryCursor += 1;
    }
  });

  const byName = new Map(nodes.map((node) => [normalizeLookupName(node.name), node]));
  const edges = [];
  const edgeSeen = new Set();

  nodes.forEach((node) => {
    edges.push({
      kind: 'self',
      from: selfNode,
      to: node,
      label: '',
      color: node.color
    });
  });

  entries.forEach(([key, profile]) => {
    const from = nodes.find((node) => node.key === key);
    if (!from) return;

    parsePartnerList(profile).forEach((partnerName) => {
      const to = byName.get(normalizeLookupName(partnerName));
      if (!to || to.key === from.key) return;

      const edgeKey = [from.key, to.key].sort().join('|');
      if (edgeSeen.has(edgeKey)) return;
      edgeSeen.add(edgeKey);

      edges.push({
        kind: 'connection',
        from,
        to,
        label: 'Shared link',
        color: from.color
      });
    });
  });

  const edgeSvg = edges.map((edge, index) => {
    const dx = edge.to.x - edge.from.x;
    const dy = edge.to.y - edge.from.y;
    const length = Math.hypot(dx, dy) || 1;
    const midX = (edge.from.x + edge.to.x) / 2;
    const midY = (edge.from.y + edge.to.y) / 2;
    const isConnection = edge.kind === 'connection';
    const normalX = -dy / length;
    const normalY = dx / length;
    const curve = isConnection ? Math.min(38, length * 0.16) : 0;
    const controlX = midX + normalX * curve;
    const controlY = midY + normalY * curve;
    const label = String(edge.label || '').trim();
    const safeLabel = label.length > 18 ? `${label.slice(0, 15)}…` : label;
    const labelX = isConnection ? (edge.from.x + edge.to.x + controlX) / 3 : midX;
    const labelY = isConnection ? (edge.from.y + edge.to.y + controlY) / 3 : midY;
    const labelWidth = Math.max(76, safeLabel.length * 7.2 + 18);
    const pathData = isConnection
      ? `M ${edge.from.x} ${edge.from.y} Q ${controlX} ${controlY} ${edge.to.x} ${edge.to.y}`
      : `M ${edge.from.x} ${edge.from.y} L ${edge.to.x} ${edge.to.y}`;

    return `
      <g>
        <title>${escapeHtml(label ? `${edge.from.name} → ${edge.to.name}: ${label}` : `${edge.from.name} → ${edge.to.name}`)}</title>
        <path class="partners-edge ${isConnection ? 'partners-edge--connection' : 'partners-edge--self'}" d="${pathData}" style="stroke:${edge.color}" />
        ${safeLabel ? `<rect class="partners-edge-label-bg" x="${labelX - labelWidth / 2}" y="${labelY - 18}" width="${labelWidth}" height="18" rx="10" ry="10" style="stroke:${edge.color}; opacity:${isConnection ? '0.94' : '0.82'}" />
        <text class="partners-edge-label" x="${labelX}" y="${labelY - 5}">${escapeHtml(safeLabel)}</text>` : ''}
      </g>
    `;
  }).join('');

  const nodeSvg = nodes.map((node) => {
    const initials = node.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'P';

    return `
      <g class="partners-node-group" data-diagram-partner="${node.key}">
        <title>${escapeHtml(`${node.name} • ${node.type}`)}</title>
        <circle class="partners-node ${selectedPartnerKey === node.key ? 'selected' : ''}" cx="${node.x}" cy="${node.y}" r="29" style="fill: color-mix(in srgb, ${node.color} 24%, var(--surface) 76%); stroke:${node.color};" />
        <text class="partners-node-label" x="${node.x}" y="${node.y + 4}">${escapeHtml(initials)}</text>
        <text class="partners-node-label partners-node-label--name" x="${node.x}" y="${node.y + 49}">${escapeHtml(node.shortName)}</text>
        <text class="partners-node-label partners-node-label--type" x="${node.x}" y="${node.y + 63}">${escapeHtml(node.type)}</text>
      </g>
    `;
  }).join('');

  const selfNodeSvg = `
    <g data-diagram-self="true">
      <title>${escapeHtml(selfNode.name)}</title>
      <circle class="partners-node self" cx="${selfNode.x}" cy="${selfNode.y}" r="35" style="stroke:${selfNode.color}" />
      <text class="partners-node-label" x="${selfNode.x}" y="${selfNode.y + 3}">YOU</text>
      <text class="partners-node-label partners-node-label--type" x="${selfNode.x}" y="${selfNode.y + 50}">${escapeHtml(selfNode.name)}</text>
    </g>
  `;

  const connectionCount = edges.filter((edge) => edge.kind === 'connection').length;
  const legendMarkup = `
    <div class="partners-diagram-legend">
      <span class="partners-diagram-chip"><strong>${nodes.length}</strong> partner${nodes.length === 1 ? '' : 's'}</span>
      <span class="partners-diagram-chip"><strong>${connectionCount}</strong> shared link${connectionCount === 1 ? '' : 's'}</span>
      <span class="partners-diagram-chip">Solid lines = your system</span>
      <span class="partners-diagram-chip">Dashed lines = partner links</span>
      <span class="partners-diagram-chip">Click a node to open that profile</span>
    </div>
  `;

  partnersDiagramCanvas.innerHTML = `<svg class="partners-diagram-svg" viewBox="0 0 ${width} ${height}">${edgeSvg}${selfNodeSvg}${nodeSvg}</svg>${legendMarkup}`;

  partnersDiagramCanvas.querySelectorAll('[data-diagram-partner]').forEach((group) => {
    group.addEventListener('click', () => {
      const key = group.getAttribute('data-diagram-partner');
      const row = document.querySelector(`#partnersTableBody tr[data-partner="${key}"]`);
      if (row) row.click();
    });
  });
}

function renderPartnersTable() {
  if (!partnersTableBody) return;
  const entries = Object.entries(partnerProfiles);
  partnersTableBody.innerHTML = entries.length
    ? entries.map(([key, profile], index) => `
      <tr data-partner="${key}" class="${selectedPartnerKey === key ? 'selected' : ''}">
        <td>#${String(index + 1).padStart(3, '0')}</td>
        <td>${escapeHtml(profile.name)}</td>
        <td>${escapeHtml(profile.relationshipType || 'Not set')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="3">No partners yet.</td></tr>';

  if (selectedPartnerKey && partnerProfiles[selectedPartnerKey]) {
    renderPartnerProfile(partnerProfiles[selectedPartnerKey]);
  } else {
    if (partnerProfile) partnerProfile.hidden = true;
    if (partnerEditor) partnerEditor.hidden = true;
    if (savePartnerBtn) savePartnerBtn.disabled = true;
  }

  renderPartnersDiagram();
  renderInnerSystemRelationships();
}

if (partnersTableBody) {
  partnersTableBody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-partner]');
    if (!row) return;
    const key = row.dataset.partner;
    const profile = partnerProfiles[key];
    if (!profile) return;

    document.querySelectorAll('#partnersTableBody tr[data-partner]').forEach((r) => r.classList.remove('selected'));
    row.classList.add('selected');
    selectedPartnerKey = key;
    creatingPartner = false;
    if (savePartnerBtn) savePartnerBtn.disabled = true;
    if (partnerEditor) partnerEditor.hidden = true;
    renderPartnerProfile(profile);
  });
}

if (addPartnerBtn) {
  addPartnerBtn.addEventListener('click', () => {
    creatingPartner = true;
    selectedPartnerKey = null;
    const defaultName = `Partner ${Object.keys(partnerProfiles).length + 1}`;
    const seed = createDefaultPartnerProfile(defaultName);
    renderPartnerProfile(seed);
    renderPartnerEditorFields(seed);
    if (savePartnerBtn) savePartnerBtn.disabled = false;
    if (partnerEditor) {
      partnerEditor.hidden = false;
      partnerEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (addPartnerFromTemplateBtn) {
  addPartnerFromTemplateBtn.addEventListener('click', () => {
    const template = pickTemplateForTarget('partner');
    if (!template) return;
    creatingPartner = true;
    selectedPartnerKey = null;
    const baseName = (template.name || '').trim() || `Partner ${Object.keys(partnerProfiles).length + 1}`;
    const seed = {
      ...createDefaultPartnerProfile(baseName),
      name: baseName,
      relationshipType: template.category || 'Partner',
      description: template.description || 'Not set',
      banner: template.banner || `${baseName} Banner`,
      color: template.color || '#6c63ff'
    };
    renderPartnerProfile(seed);
    renderPartnerEditorFields(seed);
    if (savePartnerBtn) savePartnerBtn.disabled = false;
    if (partnerEditor) {
      partnerEditor.hidden = false;
      partnerEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (editPartnerBtn) {
  editPartnerBtn.addEventListener('click', () => {
    if (!selectedPartnerKey || !partnerProfiles[selectedPartnerKey]) {
      safeAlert('Select a partner first.');
      return;
    }
    creatingPartner = false;
    renderPartnerEditorFields(partnerProfiles[selectedPartnerKey]);
    if (savePartnerBtn) savePartnerBtn.disabled = false;
    if (partnerEditor) {
      partnerEditor.hidden = false;
      partnerEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (linkPartnerAlterBtn) {
  linkPartnerAlterBtn.addEventListener('click', () => {
    if (!selectedPartnerKey || !partnerProfiles[selectedPartnerKey]) {
      safeAlert('Select a partner first.');
      return;
    }
    const partner = partnerProfiles[selectedPartnerKey];
    const headmateNames = Object.values(getActiveHeadmateProfiles()).map((profile) => profile.name);
    if (!headmateNames.length) {
      safeAlert('Add a headmate first so there is something to link.');
      return;
    }
    const rawName = safePrompt(`Enter the alter name to link to ${partner.name}. Available: ${headmateNames.join(', ')}`, headmateNames[0]);
    if (!rawName || !rawName.trim()) return;
    const key = findHeadmateKeyByName(rawName);
    if (!key) {
      safeAlert('No matching headmate was found.');
      return;
    }
    const headmate = getActiveHeadmateProfiles()[key];
    partner.linkedAlters = appendCommaLinkValue(partner.linkedAlters, headmate.name);
    headmate.partners = appendCommaLinkValue(headmate.partners, partner.name);
    renderPartnersTable();
    renderPartnerProfile(partner);
    renderHeadmatesTable();
    if (selectedHeadmateKey === key) renderHeadmateProfile(headmate);
  });
}

if (linkPartnerConnectionBtn) {
  linkPartnerConnectionBtn.addEventListener('click', () => {
    if (!selectedPartnerKey || !partnerProfiles[selectedPartnerKey]) {
      safeAlert('Select a partner first.');
      return;
    }
    const availablePartners = Object.entries(partnerProfiles)
      .filter(([key]) => key !== selectedPartnerKey)
      .map(([, profile]) => profile.name)
      .filter(Boolean);
    if (!availablePartners.length) {
      safeAlert('Add another partner first so there is someone to connect.');
      return;
    }
    const rawName = safePrompt(`Enter the partner to connect with ${partnerProfiles[selectedPartnerKey].name}. Available: ${availablePartners.join(', ')}`, availablePartners[0]);
    if (!rawName || !rawName.trim()) return;
    const otherKey = findPartnerKeyByName(rawName);
    if (!otherKey || otherKey === selectedPartnerKey) {
      safeAlert('No matching partner was found.');
      return;
    }
    const currentPartner = partnerProfiles[selectedPartnerKey];
    const otherPartner = partnerProfiles[otherKey];
    currentPartner.connections = appendCommaLinkValue(currentPartner.connections, otherPartner.name);
    otherPartner.connections = appendCommaLinkValue(otherPartner.connections, currentPartner.name);
    currentPartner.linkedProfiles = appendCommaLinkValue(currentPartner.linkedProfiles, `Partner: ${otherPartner.name}`);
    otherPartner.linkedProfiles = appendCommaLinkValue(otherPartner.linkedProfiles, `Partner: ${currentPartner.name}`);
    renderPartnersTable();
    renderPartnerProfile(currentPartner);
  });
}

if (linkPartnerProfileBtn) {
  linkPartnerProfileBtn.addEventListener('click', () => {
    if (!selectedPartnerKey || !partnerProfiles[selectedPartnerKey]) {
      safeAlert('Select a partner first.');
      return;
    }
    const partner = partnerProfiles[selectedPartnerKey];
    if (addProfileLinkToRecord(partner, 'Headmate')) {
      renderPartnersTable();
      renderPartnerProfile(partner);
    }
  });
}

if (addInnerRelationshipBtn) {
  addInnerRelationshipBtn.addEventListener('click', () => {
    const profiles = getActiveHeadmateProfiles();
    const headmateNames = Object.values(profiles || {})
      .map((profile) => String(profile?.name || '').trim())
      .filter(Boolean);

    if (headmateNames.length < 2) {
      safeAlert('Add at least two headmates first so there is a relationship to track.');
      return;
    }

    const raw = safePrompt(
      `Add an inner-system relationship as Headmate A|Headmate B|Status. Available: ${headmateNames.join(', ')}`,
      `${headmateNames[0]}|${headmateNames[1]}|Partnered`
    );
    if (!raw || !raw.trim()) return;

    const [rawFirst, rawSecond, rawStatus] = raw.split('|').map((part) => (part || '').trim());
    if (!rawFirst || !rawSecond) {
      safeAlert('Use the format Headmate A|Headmate B|Status.');
      return;
    }

    const firstKey = findHeadmateKeyByName(rawFirst);
    const secondKey = findHeadmateKeyByName(rawSecond);
    if (!firstKey || !secondKey) {
      safeAlert('Both names need to match existing headmates in the active system.');
      return;
    }
    if (firstKey === secondKey) {
      safeAlert('Choose two different headmates.');
      return;
    }

    const first = profiles[firstKey];
    const second = profiles[secondKey];
    const status = rawStatus || 'Partnered';

    first.partners = appendCommaLinkValue(first.partners, second.name || secondKey);
    second.partners = appendCommaLinkValue(second.partners, first.name || firstKey);

    if (rawStatus || /^(not set|none|n\/a|single|unpartnered)$/i.test(String(first.partnershipStatus || '').trim())) {
      first.partnershipStatus = status;
    }
    if (rawStatus || /^(not set|none|n\/a|single|unpartnered)$/i.test(String(second.partnershipStatus || '').trim())) {
      second.partnershipStatus = status;
    }

    renderHeadmatesTable();
    renderPartnersTable();
    if (selectedHeadmateKey === firstKey) renderHeadmateProfile(first);
    if (selectedHeadmateKey === secondKey) renderHeadmateProfile(second);
    safeAlert(`Linked ${first.name || firstKey} and ${second.name || secondKey} in the Partners tab.`);
  });
}

if (innerRelationshipList) {
  innerRelationshipList.addEventListener('click', (event) => {
    const openBtn = event.target.closest('[data-open-inner-headmate]');
    if (openBtn) {
      openProfileFromLink('parts', openBtn.dataset.openInnerHeadmate || '');
      return;
    }

    const removeBtn = event.target.closest('[data-remove-inner-relationship]');
    if (!removeBtn) return;

    const [firstKey, secondKey] = String(removeBtn.dataset.removeInnerRelationship || '').split('|');
    const profiles = getActiveHeadmateProfiles();
    const first = profiles[firstKey];
    const second = profiles[secondKey];
    if (!first || !second) return;

    if (!safeConfirm(`Remove the inner-system relationship between ${first.name || firstKey} and ${second.name || secondKey}?`)) {
      return;
    }

    first.partners = removeCommaLinkValue(first.partners, second.name || secondKey);
    second.partners = removeCommaLinkValue(second.partners, first.name || firstKey);

    if (!parseLinkedTextList(first.partners).length && /partner|dating|married|romantic|qpr/i.test(String(first.partnershipStatus || ''))) {
      first.partnershipStatus = 'Single';
    }
    if (!parseLinkedTextList(second.partners).length && /partner|dating|married|romantic|qpr/i.test(String(second.partnershipStatus || ''))) {
      second.partnershipStatus = 'Single';
    }

    renderHeadmatesTable();
    renderPartnersTable();
    if (selectedHeadmateKey === firstKey) renderHeadmateProfile(first);
    if (selectedHeadmateKey === secondKey) renderHeadmateProfile(second);
  });
}

if (linkPartnerAccountBtn) {
  linkPartnerAccountBtn.addEventListener('click', () => {
    if (!selectedPartnerKey || !partnerProfiles[selectedPartnerKey]) {
      safeAlert('Select a partner first.');
      return;
    }
    const userNames = Object.keys(systemProfiles);
    if (!userNames.length) {
      safeAlert('No system accounts are available yet.');
      return;
    }
    const rawName = safePrompt(`Enter the account name to set as this partner. Available: ${userNames.join(', ')}`, userNames[0]);
    if (!rawName || !rawName.trim()) return;
    const userName = findSystemUserByName(rawName);
    if (!userName) {
      safeAlert('No matching account was found.');
      return;
    }
    const partner = partnerProfiles[selectedPartnerKey];
    syncPartnerWithSystemUser(partner, userName);
    renderPartnersTable();
    renderPartnerProfile(partner);
  });
}

if (addPartnerHeadmateBtn) {
  addPartnerHeadmateBtn.addEventListener('click', () => {
    if (!selectedPartnerKey || !partnerProfiles[selectedPartnerKey]) {
      safeAlert('Select a partner first.');
      return;
    }
    const raw = safePrompt(`Add one of ${partnerProfiles[selectedPartnerKey].name}'s headmates as Name|Role`, 'Jun|Host');
    if (!raw || !raw.trim()) return;
    const [rawName, rawRole] = raw.split('|').map((part) => (part || '').trim());
    if (!rawName) {
      safeAlert('A name is required.');
      return;
    }
    const entry = rawRole ? `${rawName} (${rawRole})` : rawName;
    const partner = partnerProfiles[selectedPartnerKey];
    partner.partnerHeadmates = appendCommaLinkValue(partner.partnerHeadmates, entry);
    renderPartnersTable();
    renderPartnerProfile(partner);
  });
}

if (partnerHeadmatesList) {
  partnerHeadmatesList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-partner-headmate]');
    if (button && selectedPartnerKey && partnerProfiles[selectedPartnerKey]) {
      const rawValue = button.dataset.removePartnerHeadmate;
      const partner = partnerProfiles[selectedPartnerKey];
      const remaining = parseLinkedTextList(partner.partnerHeadmates).filter((item) => normalizeLookupName(item) !== normalizeLookupName(rawValue));
      partner.partnerHeadmates = remaining.length ? remaining.join(', ') : 'Not set';
      renderPartnerProfile(partner);
      return;
    }

    if (!selectedPartnerKey || !partnerProfiles[selectedPartnerKey]) return;
    const partner = partnerProfiles[selectedPartnerKey];

    const linkedHeadmateCard = event.target.closest('[data-partner-account-user][data-partner-account-headmate]');
    if (linkedHeadmateCard) {
      openPartnerHeadmateProfile(
        partner,
        linkedHeadmateCard.dataset.partnerAccountHeadmate || '',
        linkedHeadmateCard.dataset.partnerAccountUser || ''
      );
      return;
    }

    const customHeadmateCard = event.target.closest('[data-partner-headmate]');
    if (customHeadmateCard) {
      openPartnerHeadmateProfile(partner, customHeadmateCard.dataset.partnerHeadmate || '');
    }
  });
}

if (savePartnerBtn) {
  savePartnerBtn.addEventListener('click', () => {
    const base = creatingPartner ? createDefaultPartnerProfile('Partner') : partnerProfiles[selectedPartnerKey];
    if (!base) return;
    const previousName = String(base.name || '').trim();
    const updated = readPartnerEditorValues(base);
    const name = (updated.name || '').trim();
    if (!name) {
      safeAlert('Name is required.');
      return;
    }

    if (creatingPartner) {
      const baseKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `partner-${Date.now()}`;
      let key = baseKey;
      let suffix = 2;
      while (partnerProfiles[key]) {
        key = `${baseKey}-${suffix}`;
        suffix += 1;
      }
      partnerProfiles[key] = updated;
      selectedPartnerKey = key;
      creatingPartner = false;
    } else {
      partnerProfiles[selectedPartnerKey] = updated;
      if (normalizeLookupName(previousName) !== normalizeLookupName(name)) {
        syncPartnerRelationshipReferences(previousName, name);
      }
    }

    if (partnerEditor) partnerEditor.hidden = true;
    savePartnerBtn.disabled = true;
    renderPartnersTable();
  });
}

if (deletePartnerBtn) {
  deletePartnerBtn.addEventListener('click', () => {
    if (!selectedPartnerKey || !partnerProfiles[selectedPartnerKey]) {
      safeAlert('Select a partner first.');
      return;
    }
    const partnerName = String(partnerProfiles[selectedPartnerKey].name || '').trim();
    if (!safeConfirm(`Delete partner ${partnerName}?`)) return;
    syncPartnerRelationshipReferences(partnerName);
    delete partnerProfiles[selectedPartnerKey];
    selectedPartnerKey = null;
    creatingPartner = false;
    if (partnerEditor) partnerEditor.hidden = true;
    if (partnerProfile) partnerProfile.hidden = true;
    if (savePartnerBtn) savePartnerBtn.disabled = true;
    renderPartnersTable();
  });
}

renderPartnersTable();

if (partnersDiagramRefreshBtn) {
  partnersDiagramRefreshBtn.addEventListener('click', renderPartnersDiagram);
}

window.addEventListener('resize', () => {
  if (document.getElementById('page-friends')?.classList.contains('active')) {
    renderPartnersDiagram();
  }
  if (document.getElementById('page-notifications')?.classList.contains('active')) {
    renderLocationMap(selectedLocationKey);
  }
});

// =====================
// Headmates: Expand Profile
// =====================
const defaultHeadmateProfiles = {
  alex: {
    profilePhoto: 'A',
    banner: 'Prismatic Dawn',
    color: '#6c63ff',
    interactionStatus: 'Open to interaction',
    twsCws: 'Loud argument audio, medical themes',
    byi: 'Prefers explicit context and gentle pacing before heavy topics.',
    dni: 'Hostility, invalidation, sarcasm as default tone.',
    name: 'Alex',
    nickname: 'Lex',
    alias: 'Node-1',
    petnames: 'Starling, Captain',
    pronouns: 'they/them',
    gender: 'Nonbinary',
    orientation: 'Queer',
    amory: 'Polyamorous',
    partnershipStatus: 'Partnered',
    partners: 'Rowan, Jun',
    searching: 'Not currently',
    verbality: 'Verbal',
    aacUsage: 'Occasional text AAC during overload',
    toneTagUsage: 'Uses tone tags regularly',
    age: '27',
    ageType: 'Adult',
    birthdayRelative: 'Early spring',
    species: 'Human',
    regressor: false,
    regressionNotes: 'N/A',
    caregiver: true,
    caregiverNotes: 'Co-regulates younger parts in evening routine.',
    mainRole: 'Coordinator',
    folder: 'Front Crew',
    subfolder: 'Coordinators',
    otherRoles: 'Archivist, scheduler',
    partType: 'Core-adjacent',
    triggersPositive: 'Rain ambience, mint tea, low piano',
    triggersNeutral: 'Crowded spaces, unknown numbers',
    triggersNegative: 'Shouting, abrupt conflict escalation',
    systemGroups: 'Planning team, front support',
    sidesystem: 'North Wing',
    subsystem: 'Ops Cluster',
    formationDate: 'Approx. 2016',
    formationReason: 'Needed continuity during high-demand periods.',
    formationNotes: 'Gradual consolidation over several months.',
    sourceDetails: 'No fictional source',
    sexual: true,
    boundariesHard: 'Coercion, humiliation, explicit violence',
    boundariesSoft: 'Public affection; ask first',
    boundariesGreen: 'Verbal reassurance, hand squeezes, planned check-ins'
  },
  rowan: {
    profilePhoto: 'R',
    banner: 'Guardian Arc',
    color: '#ff6584',
    interactionStatus: 'Limited interaction',
    twsCws: 'Mentions of confinement and authority abuse',
    byi: 'Direct communicator; appreciates concise asks.',
    dni: 'Boundary pushing and testing limits for fun.',
    name: 'Rowan',
    nickname: 'Ro',
    alias: 'Aegis',
    petnames: 'Sentinel',
    pronouns: 'he/they',
    gender: 'Transmasc',
    orientation: 'Biromantic',
    amory: 'Ambiamorous',
    partnershipStatus: 'Single',
    partners: 'None',
    searching: 'Maybe, with trust established',
    verbality: 'Selective verbal',
    aacUsage: 'Primary typed AAC on low-energy days',
    toneTagUsage: 'Uses when context is unclear',
    age: '31',
    ageType: 'Adult',
    birthdayRelative: 'Late autumn',
    species: 'Human',
    regressor: false,
    regressionNotes: 'N/A',
    caregiver: true,
    caregiverNotes: 'Safety planning and de-escalation lead.',
    mainRole: 'Protector',
    folder: 'Front Crew',
    subfolder: 'Protectors',
    otherRoles: 'Boundary keeper, logistics',
    partType: 'Protector',
    triggersPositive: 'Weight blanket, instrumental metal',
    triggersNeutral: 'Unexpected schedule changes',
    triggersNegative: 'Cornering, threats, manipulative language',
    systemGroups: 'Protection team',
    sidesystem: 'Outer Ring',
    subsystem: 'Shield Unit',
    formationDate: 'Approx. 2014',
    formationReason: 'Response to recurring safety breaches.',
    formationNotes: 'Sudden appearance during crisis period.',
    sourceDetails: 'No fictional source',
    sexual: false,
    boundariesHard: 'Sexual pressure, physical restraint references',
    boundariesSoft: 'Personal questions early on',
    boundariesGreen: 'Practical checklists, explicit consent language'
  },
  kai: {
    profilePhoto: 'K',
    banner: 'Static Bloom',
    color: '#43d9ad',
    interactionStatus: 'Do not disturb',
    twsCws: 'Substance misuse, abandonment themes',
    byi: 'Can be quiet; silence is usually regulation, not disinterest.',
    dni: 'Mocking mental health symptoms.',
    name: 'Kai',
    nickname: 'K',
    alias: 'Waveform',
    petnames: 'Sprout',
    pronouns: 'they/he',
    gender: 'Agender',
    orientation: 'Aroace spectrum',
    amory: 'Not seeking romantic structures',
    partnershipStatus: 'Unpartnered',
    partners: 'None',
    searching: 'No',
    verbality: 'Semi-verbal',
    aacUsage: 'High AAC usage (symbols + text)',
    toneTagUsage: 'Strong preference for tone tags',
    age: '19',
    ageType: 'Young adult',
    birthdayRelative: 'Mid-winter',
    species: 'Human',
    regressor: true,
    regressionNotes: 'Comforted by plushies and simple routines when regressed.',
    caregiver: false,
    caregiverNotes: 'N/A',
    mainRole: 'Sensory monitor',
    folder: 'Inner Garden',
    subfolder: 'Wellbeing',
    otherRoles: 'Creative processing',
    partType: 'Trauma holder',
    triggersPositive: 'Soft textures, repetitive crafting',
    triggersNeutral: 'Bright fluorescent lighting',
    triggersNegative: 'Substance references, abandonment threats',
    systemGroups: 'Wellbeing pod',
    sidesystem: 'Inner Garden',
    subsystem: 'Care Cluster',
    formationDate: 'Approx. 2019',
    formationReason: 'Needed dedicated sensory and emotional containment.',
    formationNotes: 'Developed from recurring dissociative episodes.',
    sourceDetails: 'No fictional source',
    sexual: false,
    boundariesHard: 'Sexual content directed at them',
    boundariesSoft: 'Unexpected voice calls',
    boundariesGreen: 'Text-first check-ins, clear topic labels'
  },
  sky: {
    profilePhoto: 'S',
    banner: 'Warm Signal',
    color: '#f5a623',
    interactionStatus: 'Open to interaction',
    twsCws: 'Hospital imagery, grief-heavy narratives',
    byi: 'Highly social and uses humor to connect.',
    dni: 'Cruel teasing and public callouts.',
    name: 'Sky',
    nickname: 'Skye',
    alias: 'Lumen',
    petnames: 'Sunbeam',
    pronouns: 'she/they',
    gender: 'Genderfluid',
    orientation: 'Pansexual',
    amory: 'Poly-curious',
    partnershipStatus: 'Talking stage',
    partners: 'Mira (potential)',
    searching: 'Yes',
    verbality: 'Very verbal',
    aacUsage: 'Rare',
    toneTagUsage: 'Optional but willing',
    age: '24',
    ageType: 'Adult',
    birthdayRelative: 'High summer',
    species: 'Human',
    regressor: true,
    regressionNotes: 'Enjoys cartoons and guided breathing games.',
    caregiver: true,
    caregiverNotes: 'Can co-caregive with Alex during group regulation.',
    mainRole: 'Social connector',
    folder: 'Social Wing',
    subfolder: 'Outreach',
    otherRoles: 'Community outreach, morale',
    partType: 'Support',
    triggersPositive: 'Pop playlists, voice notes from trusted people',
    triggersNeutral: 'Sudden silence in chats',
    triggersNegative: 'Shaming language, invalidation',
    systemGroups: 'Social crew, front team',
    sidesystem: 'South Wing',
    subsystem: 'Bridge Team',
    formationDate: 'Approx. 2018',
    formationReason: 'Built to restore connection and interpersonal warmth.',
    formationNotes: 'Appeared gradually with increased external support.',
    sourceDetails: 'No fictional source',
    sexual: true,
    boundariesHard: 'Derogatory sexual comments',
    boundariesSoft: 'Flirting without prior cue',
    boundariesGreen: 'Compliments, clear opt-in communication'
  }
};

const headmateProfilesByUser = {};
const headmateFoldersByUser = {};
const headmateProfilePanel = document.getElementById('headmateProfile');
const headmateProfileGrid = document.getElementById('headmateProfileGrid');
const headmateBanner = document.getElementById('headmateBanner');
const headmatePhoto = document.getElementById('headmatePhoto');
const headmateName = document.getElementById('headmateName');
const headmateMeta = document.getElementById('headmateMeta');
const headmatesTableBody = document.querySelector('#page-parts tbody');
const headmatesSearchInput = document.getElementById('headmatesSearchInput');
const headmateFolderFilter = document.getElementById('headmateFolderFilter');
const headmateSubfolderFilter = document.getElementById('headmateSubfolderFilter');
const manageHeadmateFoldersBtn = document.getElementById('manageHeadmateFoldersBtn');
const headmateFolderTree = document.getElementById('headmateFolderTree');
const headmateFolderOptions = document.getElementById('headmateFolderOptions');
const headmateSubfolderOptions = document.getElementById('headmateSubfolderOptions');
const bulkAddHeadmatesBtn = document.getElementById('bulkAddHeadmatesBtn');
const addHeadmateBtn = document.getElementById('addHeadmateBtn');
const addHeadmateFromTemplateBtn = document.getElementById('addHeadmateFromTemplateBtn');
const editHeadmateBtn = document.getElementById('editHeadmateBtn');
const linkHeadmateSubsystemBtn = document.getElementById('linkHeadmateSubsystemBtn');
const linkHeadmateProfileBtn = document.getElementById('linkHeadmateProfileBtn');
const saveHeadmateBtn = document.getElementById('saveHeadmateBtn');
const deleteHeadmateBtn = document.getElementById('deleteHeadmateBtn');
const headmateEditor = document.getElementById('headmateEditor');
const headmateEditorFields = document.getElementById('headmateEditorFields');
let selectedHeadmateKey = null;
let pendingHeadmateDraft = null;
let creatingHeadmate = false;

const headmateFieldSchema = [
  { key: 'profilePhoto', label: 'Profile photo' },
  { key: 'banner', label: 'Banner' },
  { key: 'color', label: 'Color' },
  { key: 'tags', label: 'Tags' },
  { key: 'customFields', label: 'Custom fields', type: 'textarea' },
  { key: 'interactionStatus', label: 'Interaction status' },
  { key: 'twsCws', label: 'TWs/CWs', type: 'textarea' },
  { key: 'byi', label: 'BYI', type: 'textarea' },
  { key: 'dni', label: 'DNI', type: 'textarea' },
  { key: 'name', label: 'Name' },
  { key: 'nickname', label: 'Nickname' },
  { key: 'alias', label: 'Alias' },
  { key: 'petnames', label: 'Petnames' },
  { key: 'pronouns', label: 'Pronouns' },
  { key: 'gender', label: 'Gender' },
  { key: 'orientation', label: 'Orientation' },
  { key: 'amory', label: 'Amory' },
  { key: 'partnershipStatus', label: 'Partnership status' },
  { key: 'partners', label: 'Partner(s)' },
  { key: 'searching', label: 'Searching?' },
  { key: 'verbality', label: 'Verbality' },
  { key: 'aacUsage', label: 'AAC usage' },
  { key: 'toneTagUsage', label: 'Tone tag usage' },
  { key: 'age', label: 'Age' },
  { key: 'ageType', label: 'Age type' },
  { key: 'birthdayRelative', label: 'Birthday (relative)' },
  { key: 'species', label: 'Species' },
  { key: 'regressor', label: 'Regressor?', type: 'boolean' },
  { key: 'regressionNotes', label: 'Regression notes', type: 'textarea' },
  { key: 'caregiver', label: 'Caregiver?', type: 'boolean' },
  { key: 'caregiverNotes', label: 'Caregiver notes', type: 'textarea' },
  { key: 'mainRole', label: 'Main role' },
  { key: 'folder', label: 'Folder' },
  { key: 'subfolder', label: 'Subfolder' },
  { key: 'otherRoles', label: 'Other roles', type: 'textarea' },
  { key: 'partType', label: 'Part type' },
  { key: 'triggersPositive', label: 'Triggers (positive)', type: 'textarea' },
  { key: 'triggersNeutral', label: 'Triggers (neutral)', type: 'textarea' },
  { key: 'triggersNegative', label: 'Triggers (negative)', type: 'textarea' },
  { key: 'systemGroups', label: 'System groups' },
  { key: 'sidesystem', label: 'Sidesystem' },
  { key: 'subsystem', label: 'Subsystem' },
  { key: 'linkedProfiles', label: 'Linked profiles' },
  { key: 'formationDate', label: 'Formation date' },
  { key: 'formationReason', label: 'Formation reason', type: 'textarea' },
  { key: 'formationNotes', label: 'Formation notes', type: 'textarea' },
  { key: 'sourceDetails', label: 'Source details', type: 'textarea' },
  { key: 'sexual', label: 'Sexual?', type: 'boolean' },
  { key: 'boundariesHard', label: 'Boundaries (hard)', type: 'textarea' },
  { key: 'boundariesSoft', label: 'Boundaries (soft)', type: 'textarea' },
  { key: 'boundariesGreen', label: 'Boundaries (green light)', type: 'textarea' }
];

function renderHeadmateEditorFields(profile) {
  if (!headmateEditorFields) return;
  updateHeadmateFolderDatalists();
  const fp = profile.fieldPrivacy || {};

  headmateEditorFields.innerHTML = headmateFieldSchema.map((field) => {
    const id = `headmateEdit_${field.key}`;
    const value = profile[field.key];
    const safeValue = value === undefined || value === null ? '' : String(value);
    const privSel = renderPrivacySelect(`priv_headmateEdit_${field.key}`, fp[field.key] || 'public');

    let inputHtml;
    if (field.type === 'boolean') {
      inputHtml = `<label>${field.label}<select class="setting-input" id="${id}"><option value="true" ${value ? 'selected' : ''}>Yes</option><option value="false" ${!value ? 'selected' : ''}>No</option></select></label>`;
    } else {
      inputHtml = renderFieldInput(field, id, safeValue);
    }
    return `<div class="editor-field-row">${inputHtml}${privSel}</div>`;
  }).join('');

  bindColorPickers(headmateEditorFields);
  bindAutoGrowingTextareas(headmateEditorFields);
}

function readHeadmateEditorValues(baseProfile) {
  const updated = { ...baseProfile };

  headmateFieldSchema.forEach((field) => {
    const element = document.getElementById(`headmateEdit_${field.key}`);
    if (!element) return;

    if (field.type === 'boolean') {
      updated[field.key] = element.value === 'true';
      return;
    }

    const rawValue = getEditorInputValue(element);
    updated[field.key] = rawValue ? rawValue : (baseProfile[field.key] ?? 'Not set');
  });

  updated.fieldPrivacy = readFieldPrivacy(headmateFieldSchema, 'headmateEdit', baseProfile);
  return updated;
}

function ensureHeadmateStoreForUser(userName) {
  if (!headmateProfilesByUser[userName]) headmateProfilesByUser[userName] = {};
  return headmateProfilesByUser[userName];
}

function getActiveUserName() {
  return (currentUsername?.textContent || NO_SYSTEM_USER).trim() || NO_SYSTEM_USER;
}

function getActiveHeadmateProfiles() {
  return ensureHeadmateStoreForUser(getActiveUserName());
}

function normalizeFolderName(value, fallback = 'Unsorted') {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function normalizeSubfolderName(value, fallback = 'General') {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function ensureHeadmateFolderStore(userName) {
  if (!headmateFoldersByUser[userName]) {
    headmateFoldersByUser[userName] = [{ name: 'Unsorted', subfolders: ['General'] }];
  }

  const folders = headmateFoldersByUser[userName];
  const profiles = ensureHeadmateStoreForUser(userName);

  Object.values(profiles).forEach((profile) => {
    const folderName = normalizeFolderName(profile.folder, 'Unsorted');
    const subfolderName = normalizeSubfolderName(profile.subfolder, 'General');
    profile.folder = folderName;
    profile.subfolder = subfolderName;

    let folder = folders.find((item) => normalizeLookupName(item.name) === normalizeLookupName(folderName));
    if (!folder) {
      folder = { name: folderName, subfolders: [] };
      folders.push(folder);
    }
    if (!Array.isArray(folder.subfolders)) folder.subfolders = [];
    if (!folder.subfolders.some((item) => normalizeLookupName(item) === normalizeLookupName(subfolderName))) {
      folder.subfolders.push(subfolderName);
    }
  });

  if (!folders.length) {
    folders.push({ name: 'Unsorted', subfolders: ['General'] });
  }

  return folders;
}

function getActiveHeadmateFolders() {
  return ensureHeadmateFolderStore(getActiveUserName());
}

function ensureHeadmateFolderPath(profile) {
  if (!profile) return { folder: 'Unsorted', subfolder: 'General' };
  const folder = normalizeFolderName(profile.folder, 'Unsorted');
  const subfolder = normalizeSubfolderName(profile.subfolder, 'General');
  profile.folder = folder;
  profile.subfolder = subfolder;
  ensureHeadmateFolderStore(getActiveUserName());
  return { folder, subfolder };
}

function getHeadmateSubfolderOptions(folderName = 'all') {
  const folders = getActiveHeadmateFolders();
  if (folderName && folderName !== 'all') {
    const folder = folders.find((item) => normalizeLookupName(item.name) === normalizeLookupName(folderName));
    return folder ? [...new Set(folder.subfolders || [])].sort((a, b) => a.localeCompare(b)) : [];
  }
  return [...new Set(folders.flatMap((item) => item.subfolders || []))].sort((a, b) => a.localeCompare(b));
}

function updateHeadmateFolderDatalists() {
  const folders = getActiveHeadmateFolders();
  if (headmateFolderOptions) {
    headmateFolderOptions.innerHTML = folders
      .map((folder) => `<option value="${escapeHtml(folder.name)}"></option>`)
      .join('');
  }
  if (headmateSubfolderOptions) {
    headmateSubfolderOptions.innerHTML = getHeadmateSubfolderOptions(headmateFolderFilter?.value || 'all')
      .map((subfolder) => `<option value="${escapeHtml(subfolder)}"></option>`)
      .join('');
  }
}

function renderHeadmateFolderFilters() {
  const folders = getActiveHeadmateFolders();
  const currentFolder = headmateFolderFilter?.value || 'all';
  const currentSubfolder = headmateSubfolderFilter?.value || 'all';

  if (headmateFolderFilter) {
    headmateFolderFilter.innerHTML = ['<option value="all">All Folders</option>']
      .concat(folders.map((folder) => `<option value="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</option>`))
      .join('');
    headmateFolderFilter.value = folders.some((folder) => folder.name === currentFolder) ? currentFolder : 'all';
  }

  const subfolderOptions = getHeadmateSubfolderOptions(headmateFolderFilter?.value || 'all');
  if (headmateSubfolderFilter) {
    headmateSubfolderFilter.innerHTML = ['<option value="all">All Subfolders</option>']
      .concat(subfolderOptions.map((subfolder) => `<option value="${escapeHtml(subfolder)}">${escapeHtml(subfolder)}</option>`))
      .join('');
    headmateSubfolderFilter.value = subfolderOptions.includes(currentSubfolder) ? currentSubfolder : 'all';
  }

  updateHeadmateFolderDatalists();
}

function renderHeadmateFolderTree(entries = Object.entries(getActiveHeadmateProfiles())) {
  if (!headmateFolderTree) return;

  const folders = getActiveHeadmateFolders();
  const activeFolder = headmateFolderFilter?.value || 'all';
  const activeSubfolder = headmateSubfolderFilter?.value || 'all';
  const counts = new Map();

  entries.forEach(([, profile]) => {
    const { folder, subfolder } = ensureHeadmateFolderPath(profile);
    counts.set(`folder:${folder}`, (counts.get(`folder:${folder}`) || 0) + 1);
    counts.set(`sub:${folder}:${subfolder}`, (counts.get(`sub:${folder}:${subfolder}`) || 0) + 1);
  });

  headmateFolderTree.innerHTML = `
    <button class="folder-filter-chip ${activeFolder === 'all' ? 'active' : ''}" type="button" data-folder-filter="all" data-subfolder-filter="all">
      All ${escapeHtml(getTermLabel('headmates'))} <span class="badge">${entries.length}</span>
    </button>
    ${folders.map((folder) => {
      const subfolders = [...new Set(folder.subfolders || [])].sort((a, b) => a.localeCompare(b));
      const folderCount = counts.get(`folder:${folder.name}`) || 0;
      return `
        <div class="headmate-folder-group">
          <button class="folder-filter-chip ${activeFolder === folder.name && activeSubfolder === 'all' ? 'active' : ''}" type="button" data-folder-filter="${escapeHtml(folder.name)}" data-subfolder-filter="all">
            📁 ${escapeHtml(folder.name)} <span class="badge">${folderCount}</span>
          </button>
          <div class="headmate-subfolder-list">
            ${subfolders.map((subfolder) => `
              <button class="folder-filter-chip folder-filter-chip--sub ${activeFolder === folder.name && activeSubfolder === subfolder ? 'active' : ''}" type="button" data-folder-filter="${escapeHtml(folder.name)}" data-subfolder-filter="${escapeHtml(subfolder)}">
                ↳ ${escapeHtml(subfolder)} <span class="badge">${counts.get(`sub:${folder.name}:${subfolder}`) || 0}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
  `;
}

document.querySelectorAll('.user-option[data-user]').forEach((opt) => {
  ensureHeadmateStoreForUser(opt.dataset.user);
  ensureHeadmateFolderStore(opt.dataset.user);
});

function boolChip(value) {
  return `<span class="toggle-chip ${value ? 'yes' : 'no'}">${value ? 'Yes' : 'No'}</span>`;
}

// =====================
// Privacy Level System
// =====================
const PRIVACY_LEVELS = ['public', 'friends', 'trusted', 'partners', 'private'];

function canViewField(fieldLevel, viewerLevel) {
  return PRIVACY_LEVELS.indexOf(viewerLevel || 'private') >= PRIVACY_LEVELS.indexOf(fieldLevel || 'public');
}

function getViewerTrustLevel() {
  if (loggedInAccountKey && accounts[loggedInAccountKey]) {
    const activeUser = normalizeLookupName(getActiveUserName());
    const matchingAccountKey = Object.keys(accounts).find((key) => normalizeLookupName(key) === activeUser);
    if (matchingAccountKey && matchingAccountKey !== loggedInAccountKey) {
      return normalizeAccountTrustLevel(accounts[matchingAccountKey]?.friends?.[loggedInAccountKey], 'public');
    }
    return 'private';
  }

  const user = getActiveUserName();
  return systemProfiles[user]?.trustLevel || 'public';
}

function renderPrivacySelect(id, current) {
  const opts = PRIVACY_LEVELS.map((l) =>
    `<option value="${l}"${current === l ? ' selected' : ''}>${l.charAt(0).toUpperCase() + l.slice(1)}</option>`
  ).join('');
  return `<select class="privacy-select" id="${id}" title="Who can see this field">${opts}</select>`;
}

function readFieldPrivacy(schema, prefix, baseProfile) {
  const privacy = { ...(baseProfile.fieldPrivacy || {}) };
  schema.forEach((field) => {
    const el = document.getElementById(`priv_${prefix}_${field.key}`);
    if (el) privacy[field.key] = el.value;
  });
  return privacy;
}

function privacyBadge(level) {
  if (!level || level === 'public') return '';
  return `<span class="privacy-badge privacy-badge--${level}">${escapeHtml(level)}</span>`;
}

function getModulePrivacyLevel(module) {
  switch (module) {
    case 'parts': return privacySettings?.headmatesVisible ? 'public' : 'private';
    case 'friends': return privacySettings?.partnersVisible ? 'public' : 'private';
    case 'accountFriends': return 'private';
    case 'journal': return privacySettings?.journalVisible ? 'public' : 'private';
    case 'health': return privacySettings?.healthVisible ? 'public' : 'private';
    case 'calendar': return privacySettings?.historyVisible ? 'public' : 'private';
    case 'notifications': return privacySettings?.locationsVisible ? 'public' : 'private';
    default: return 'public';
  }
}

function canAccessModule(module) {
  if (typeof isModuleEnabled === 'function' && !isModuleEnabled(module)) return false;
  if (!USE_BACKEND_AUTH || typeof isSignedIn !== 'function' || !isSignedIn()) return true;
  return canViewField(getModulePrivacyLevel(module), getViewerTrustLevel());
}

function normalizeLookupName(value) {
  return String(value || '').trim().toLowerCase();
}

function findHeadmateKeyByName(name) {
  const normalized = normalizeLookupName(name);
  return Object.entries(getActiveHeadmateProfiles()).find(([key, profile]) => {
    return normalizeLookupName(key) === normalized || normalizeLookupName(profile.name) === normalized;
  })?.[0] || null;
}

function findPartnerKeyByName(name) {
  const normalized = normalizeLookupName(name);
  return Object.entries(partnerProfiles).find(([key, profile]) => {
    return normalizeLookupName(key) === normalized || normalizeLookupName(profile.name) === normalized;
  })?.[0] || null;
}

function findSubsystemKeyByName(name) {
  const normalized = normalizeLookupName(name);
  return Object.entries(getActiveSubsystems()).find(([key, profile]) => {
    return normalizeLookupName(key) === normalized || normalizeLookupName(profile.name) === normalized;
  })?.[0] || null;
}

function findLocationKeyByName(name) {
  const normalized = normalizeLookupName(name);
  return Object.entries(locationProfiles).find(([key, profile]) => {
    return normalizeLookupName(key) === normalized || normalizeLookupName(profile.name) === normalized;
  })?.[0] || null;
}

function findItemKeyByName(name) {
  const normalized = normalizeLookupName(name);
  return Object.entries(itemProfiles).find(([key, profile]) => {
    return normalizeLookupName(key) === normalized || normalizeLookupName(profile.name) === normalized;
  })?.[0] || null;
}

function findSystemUserByName(name) {
  const normalized = normalizeLookupName(name);
  return Object.keys(systemProfiles).find((user) => normalizeLookupName(user) === normalized || normalizeLookupName(systemProfiles[user]?.name) === normalized) || null;
}

function findAccountByName(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  const normalized = normalizeLookupName(raw.replace(/^@+/, ''));
  if (!normalized) return null;

  const localMatch = Object.values(accounts || {}).find((account) => {
    return normalizeLookupName(account?.username) === normalized || normalizeLookupName(account?.name) === normalized;
  });
  if (localMatch?.username) return localMatch.username;

  const remoteMatch = Array.isArray(remoteAccountDirectory)
    ? remoteAccountDirectory.find((account) => {
        return normalizeLookupName(account?.username) === normalized || normalizeLookupName(account?.name) === normalized;
      })
    : null;
  if (remoteMatch?.username) return remoteMatch.username;

  return /^[a-z0-9_-]{2,32}$/i.test(normalized) ? normalized : null;
}

function parseAccountAlterReference(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^@?([a-z0-9_-]{2,32})\s*(?:\/|->|\||: )\s*(.+)$/i);
  if (!match) return null;
  const username = findAccountByName(match[1]) || String(match[1] || '').trim().toLowerCase();
  const alterName = String(match[2] || '').trim();
  if (!username || !alterName) return null;
  return {
    username,
    alterName,
    key: `account-alter::${encodeURIComponent(username)}::${encodeURIComponent(alterName)}`,
    label: `@${username} / ${alterName}`
  };
}

const PROFILE_LINK_TARGETS = [
  { label: 'Headmate', module: 'parts', aliases: ['headmate', 'alter', 'headmates', 'alters'], resolver: findHeadmateKeyByName },
  { label: 'Partner', module: 'friends', aliases: ['partner', 'partners'], resolver: findPartnerKeyByName },
  { label: 'Subsystem', module: 'partners', aliases: ['subsystem', 'subsystems'], resolver: findSubsystemKeyByName },
  { label: 'Location', module: 'notifications', aliases: ['location', 'locations', 'innerworld'], resolver: findLocationKeyByName },
  { label: 'Item', module: 'items', aliases: ['item', 'items'], resolver: findItemKeyByName },
  { label: 'System', module: 'system', aliases: ['system', 'systems', 'user', 'users', 'system profile'], resolver: findSystemUserByName },
  { label: 'Account', module: 'accountFriends', aliases: ['account', 'accounts', 'member account', 'login account'], resolver: findAccountByName },
  { label: 'Account Alter', module: 'accountFriends', aliases: ['account alter', 'account alters', 'friend alter', 'friend alters'], resolver: (label) => parseAccountAlterReference(label)?.key || null }
];

function getProfileLinkTarget(typeName) {
  const normalized = normalizeLookupName(typeName);
  return PROFILE_LINK_TARGETS.find((target) =>
    normalizeLookupName(target.label) === normalized || target.aliases.some((alias) => normalizeLookupName(alias) === normalized)
  ) || null;
}

function parseLinkedTextList(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !['not set', 'none', 'n/a'].includes(part.toLowerCase()));
}

function setCommaLinkValues(values) {
  const seen = new Set();
  const list = Array.isArray(values) ? values : parseLinkedTextList(values);
  const cleaned = list
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      const normalized = normalizeLookupName(item);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  return cleaned.length ? cleaned.join(', ') : 'Not set';
}

function appendCommaLinkValue(existing, nextValue) {
  const values = parseLinkedTextList(existing);
  if (!values.some((item) => normalizeLookupName(item) === normalizeLookupName(nextValue))) {
    values.push(nextValue);
  }
  return setCommaLinkValues(values);
}

function replaceCommaLinkValue(existing, previousValue, nextValue) {
  return setCommaLinkValues(
    parseLinkedTextList(existing).map((item) => (
      normalizeLookupName(item) === normalizeLookupName(previousValue) ? nextValue : item
    ))
  );
}

function removeCommaLinkValue(existing, valueToRemove) {
  return setCommaLinkValues(
    parseLinkedTextList(existing).filter((item) => normalizeLookupName(item) !== normalizeLookupName(valueToRemove))
  );
}

function syncPartnerRelationshipReferences(previousName, nextName = '') {
  const oldName = String(previousName || '').trim();
  const newName = String(nextName || '').trim();
  if (!oldName) return;

  Object.values(partnerProfiles).forEach((profile) => {
    profile.connections = newName
      ? replaceCommaLinkValue(profile.connections, oldName, newName)
      : removeCommaLinkValue(profile.connections, oldName);

    const updatedLinkedProfiles = parseLinkedTextList(profile.linkedProfiles)
      .map((item) => {
        const match = item.match(/^Partner:\s*(.+)$/i);
        if (!match) return item;
        if (normalizeLookupName(match[1]) !== normalizeLookupName(oldName)) return item;
        return newName ? `Partner: ${newName}` : '';
      })
      .filter(Boolean);

    profile.linkedProfiles = setCommaLinkValues(updatedLinkedProfiles);
  });

  Object.values(getActiveHeadmateProfiles()).forEach((headmate) => {
    headmate.partners = newName
      ? replaceCommaLinkValue(headmate.partners, oldName, newName)
      : removeCommaLinkValue(headmate.partners, oldName);
  });
}

function resolveProfileReference(part) {
  const match = String(part || '').match(/^([^:]+):\s*(.+)$/);
  if (match) {
    const target = getProfileLinkTarget(match[1]);
    const label = match[2].trim();
    const key = target?.resolver(label);
    return target ? { target, key, label } : null;
  }

  for (const target of PROFILE_LINK_TARGETS) {
    const key = target.resolver(part);
    if (key) return { target, key, label: String(part).trim() };
  }

  return null;
}

function renderGenericProfileLinks(text) {
  const parts = parseLinkedTextList(text);
  if (!parts.length) return escapeHtml(String(text || 'Not set'));
  return parts.map((part) => {
    const resolved = resolveProfileReference(part);
    return resolved?.key
      ? renderRelationLink(resolved.target.module, resolved.key, resolved.label)
      : `<span>${escapeHtml(part)}</span>`;
  }).join(', ');
}

function promptForProfileLink(defaultType = 'Headmate') {
  const typeOptions = PROFILE_LINK_TARGETS.map((target) => target.label).join(', ');
  const rawType = safePrompt(`Which type of profile do you want to link? (${typeOptions})`, defaultType);
  if (!rawType || !rawType.trim()) return null;
  const target = getProfileLinkTarget(rawType);
  if (!target) {
    safeAlert('Unknown profile type.');
    return null;
  }

  const suggestions = (() => {
    switch (target.module) {
      case 'parts': return Object.values(getActiveHeadmateProfiles()).map((profile) => profile.name).join(', ');
      case 'friends': return Object.values(partnerProfiles).map((profile) => profile.name).join(', ');
      case 'partners': return Object.values(getActiveSubsystems()).map((profile) => profile.name).join(', ');
      case 'notifications': return Object.values(locationProfiles).map((profile) => profile.name).join(', ');
      case 'items': return Object.values(itemProfiles).map((profile) => profile.name).join(', ');
      case 'system': return Object.keys(systemProfiles).join(', ');
      case 'accountFriends': {
        const accountNames = (Array.isArray(remoteAccountDirectory) && remoteAccountDirectory.length ? remoteAccountDirectory : Object.values(accounts))
          .map((profile) => `@${profile.username || profile.name || 'account'}`);
        return target.label === 'Account Alter'
          ? `${accountNames.join(', ')} — format: @username / Alter Name`
          : accountNames.join(', ');
      }
      default: return '';
    }
  })();

  const defaultValue = target.label === 'Account Alter' ? '@username / Alter Name' : '';
  const rawName = safePrompt(
    `Enter the ${target.label} name to link${suggestions ? `. Available: ${suggestions}` : ''}`,
    defaultValue
  );
  if (!rawName || !rawName.trim()) return null;

  return `${target.label}: ${rawName.trim()}`;
}

function addProfileLinkToRecord(record, defaultType = 'Headmate') {
  if (!record) return false;
  const token = promptForProfileLink(defaultType);
  if (!token) return false;
  record.linkedProfiles = appendCommaLinkValue(record.linkedProfiles, token);
  return true;
}

function renderRelationLink(module, key, label) {
  return `<button class="relation-link" type="button" data-nav-module="${module}" data-nav-key="${key}">${escapeHtml(label)}</button>`;
}

function renderStoredMediaValue(value, label = 'Saved image/GIF') {
  const raw = String(value || '').trim();
  if (!isMediaUrl(raw)) return '';

  return `
    <div class="stored-media-preview">
      <div class="stored-media-preview-thumb" style="background-image:url('${escapeCssUrl(raw)}')"></div>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function renderProfileFieldValue(context, field, profile) {
  if (field.type === 'boolean') return boolChip(Boolean(profile[field.key]));

  const raw = profile[field.key] ?? 'Not set';
  const text = String(raw);
  const normalized = text.trim().toLowerCase();
  if (!text.trim() || ['not set', 'none', 'n/a'].includes(normalized)) {
    return escapeHtml(text || 'Not set');
  }

  if (field.key === 'profilePhoto' && isMediaUrl(text)) {
    return renderStoredMediaValue(text, 'Uploaded photo/GIF');
  }
  if (field.key === 'banner' && isMediaUrl(text)) {
    return renderStoredMediaValue(text, 'Saved banner image/GIF');
  }

  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  const linkify = (module, resolver) => parts.map((part) => {
    const key = resolver(part);
    return key ? renderRelationLink(module, key, part) : `<span>${escapeHtml(part)}</span>`;
  }).join(', ');

  switch (`${context}:${field.key}`) {
    case 'headmate:partners':
      return linkify('friends', findPartnerKeyByName);
    case 'headmate:subsystem':
    case 'headmate:sidesystem':
      return linkify('partners', findSubsystemKeyByName);
    case 'partner:connections':
      return linkify('friends', findPartnerKeyByName);
    case 'partner:linkedSystemUser': {
      const key = findSystemUserByName(text);
      return key ? renderRelationLink('system', key, text) : escapeHtml(text);
    }
    case 'partner:linkedAlters':
      return linkify('parts', findHeadmateKeyByName);
    case 'location:associatedAlters':
    case 'item:associatedAlters':
      return linkify('parts', findHeadmateKeyByName);
    case 'location:connectedLocations':
      return linkify('notifications', findLocationKeyByName);
    case 'headmate:linkedProfiles':
    case 'partner:linkedProfiles':
    case 'location:linkedProfiles':
    case 'item:linkedProfiles':
    case 'subsystem:linkedProfiles':
      return renderGenericProfileLinks(text);
    case 'headmate:tags':
    case 'partner:tags':
    case 'subsystem:tags':
    case 'location:tags':
    case 'item:tags':
    case 'item:tag':
      return renderTagPills(text);
    case 'headmate:customFields':
    case 'partner:customFields':
    case 'subsystem:customFields':
    case 'location:customFields':
    case 'item:customFields':
      return renderCustomFieldSummary(text);
    default:
      return renderMarkdown(text);
  }
}

function openProfileFromLink(module, key) {
  if (!key) return;
  navigateTo(module);

  if (module === 'profile') {
    if (loggedInAccountKey && normalizeLookupName(key) !== normalizeLookupName(loggedInAccountKey)) {
      safeAlert(`Sign into @${key} to open that account profile directly.`);
    }
    renderAccountModule();
    accountProfileView?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (module === 'accountFriends') {
    const rawKey = String(key || '').trim();
    if (rawKey.startsWith('account-alter::')) {
      const [, encodedUser = '', encodedAlter = ''] = rawKey.split('::');
      const username = decodeURIComponent(encodedUser || '').trim();
      const alterName = decodeURIComponent(encodedAlter || '').trim();
      if (friendUsernameInput) friendUsernameInput.value = username;
      if (alterName) {
        safeAlert(`Linked account alter: @${username} / ${alterName}. Use the Friends tab to connect that account.`);
      }
    } else if (friendUsernameInput) {
      friendUsernameInput.value = decodeURIComponent(rawKey).replace(/^@+/, '').trim();
    }
    friendUsernameInput?.focus();
    accountFriendsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (module === 'parts') {
    const profiles = getActiveHeadmateProfiles();
    if (!profiles[key]) return;
    selectedHeadmateKey = key;
    renderHeadmatesTable();
    document.querySelector(`#page-parts [data-headmate="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (module === 'friends') {
    if (!partnerProfiles[key]) return;
    selectedPartnerKey = key;
    renderPartnersTable();
    document.querySelector(`#partnersTableBody tr[data-partner="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (module === 'system') {
    if (!systemProfiles[key]) return;
    const card = Array.from(document.querySelectorAll('#page-system [data-system-user]')).find((el) => decodeURIComponent(el.dataset.systemUser || '') === key);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (module === 'partners') {
    if (!getActiveSubsystems()[key]) return;
    selectedSubsystemKey = key;
    renderSubsystemsGrid();
    renderSubsystemProfile(key);
    subsystemProfile?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (module === 'notifications') {
    if (!locationProfiles[key]) return;
    selectedLocationKey = key;
    renderLocationsTable(locationsSearch?.value || '');
    renderLocationProfile(locationProfiles[key]);
    locationProfile?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (module === 'items') {
    if (!itemProfiles[key]) return;
    selectedItemKey = key;
    renderItemsTable(itemsSearch?.value || '');
    renderItemProfile(itemProfiles[key]);
    itemProfile?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function getTaggableProfileRecords() {
  const viewerLevel = typeof getViewerTrustLevel === 'function' ? getViewerTrustLevel() : 'public';
  const records = [];
  const seen = new Set();

  const pushRecord = (module, key, type, profile = {}, options = {}) => {
    if (!profile) return;
    const dedupeKey = `${module}:${String(key || profile.username || profile.name || type).trim().toLowerCase()}`;
    if (seen.has(dedupeKey)) return;

    const tagVisibility = profile?.fieldPrivacy?.tags || 'public';
    if (!canViewField(tagVisibility, viewerLevel)) return;

    const tags = [...new Set(parseLinkedTextList(profile?.tags ?? profile?.tag ?? '')
      .map((tag) => tag.replace(/^#/, '').trim())
      .filter(Boolean))];
    if (!tags.length) return;

    const customVisibility = profile?.fieldPrivacy?.customFields || 'public';
    const name = String(options.name || profile.name || profile.username || key || type).trim() || type;
    const subtitle = String(options.subtitle || profile.role || profile.type || profile.status || '').trim();

    records.push({
      module,
      key: String(key || profile.username || name),
      type,
      name,
      subtitle,
      tags,
      customFieldCount: canViewField(customVisibility, viewerLevel) ? parseCustomFieldEntries(profile?.customFields).length : 0,
      color: normalizeHexColor(profile?.color || options.color || '#6c63ff', '#6c63ff'),
      photo: profile?.profilePhoto || options.photo || name[0]?.toUpperCase() || '?',
      openable: options.openable !== false
    });
    seen.add(dedupeKey);
  };

  Object.entries(systemProfiles || {}).forEach(([key, profile]) => {
    pushRecord('system', key, 'System', profile, { subtitle: profile?.nickname || 'System profile' });
  });

  const currentAccount = typeof getCurrentAccountRecord === 'function' ? getCurrentAccountRecord() : null;
  if (currentAccount) {
    pushRecord('profile', currentAccount.username || loggedInAccountKey, 'Account', currentAccount, {
      subtitle: `@${currentAccount.username || loggedInAccountKey}`,
      openable: true
    });
  }

  Object.entries(getActiveHeadmateProfiles()).forEach(([key, profile]) => {
    pushRecord('parts', key, getSingularTerm('headmates'), profile, {
      subtitle: profile?.role || profile?.region || profile?.status || `${getSingularTerm('headmates')} profile`
    });
  });

  Object.entries(partnerProfiles || {}).forEach(([key, profile]) => {
    pushRecord('friends', key, getSingularTerm('partners'), profile, {
      subtitle: profile?.type || profile?.status || 'Partner profile'
    });
  });

  Object.entries(getActiveSubsystems()).forEach(([key, profile]) => {
    pushRecord('partners', key, getSingularTerm('subsystem'), profile, {
      subtitle: profile?.description || 'Subsystem profile'
    });
  });

  Object.entries(itemProfiles || {}).forEach(([key, profile]) => {
    pushRecord('items', key, 'Item', profile, {
      subtitle: profile?.tag || 'Item profile',
      photo: profile?.name?.[0]?.toUpperCase() || 'I'
    });
  });

  Object.entries(locationProfiles || {}).forEach(([key, profile]) => {
    pushRecord('notifications', key, getTermLabel('innerworld'), profile, {
      subtitle: profile?.type || 'Location profile',
      photo: profile?.name?.[0]?.toUpperCase() || 'L'
    });
  });

  return records.sort((a, b) => a.name.localeCompare(b.name));
}

function renderTagsModule() {
  if (!tagCloud || !tagResultsGrid || !tagSummary) return;

  const records = getTaggableProfileRecords();
  const moduleFilter = tagTypeFilter?.value || 'all';
  const filteredRecords = moduleFilter === 'all'
    ? records
    : records.filter((record) => record.module === moduleFilter);

  const tagMap = new Map();
  filteredRecords.forEach((record) => {
    record.tags.forEach((tag) => {
      const key = normalizeLookupName(tag);
      if (!key) return;
      if (!tagMap.has(key)) {
        tagMap.set(key, { label: tag, count: 0, records: [] });
      }
      const entry = tagMap.get(key);
      entry.count += 1;
      entry.records.push(record);
    });
  });

  const tagEntries = Array.from(tagMap.entries())
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));

  if (activeTagFilter !== 'all' && !tagEntries.some((entry) => entry.key === activeTagFilter)) {
    activeTagFilter = 'all';
  }

  tagSummary.textContent = filteredRecords.length
    ? `${filteredRecords.length} tagged profiles in this account across ${tagEntries.length} tag${tagEntries.length === 1 ? '' : 's'}. Tags stay separate from folders and stay scoped to this account.`
    : 'No tagged profiles in this account yet. Add comma-separated tags to any profile here and it will show up.';

  tagCloud.innerHTML = [
    `<button class="tag-pill tag-pill-btn ${activeTagFilter === 'all' ? 'active' : ''}" type="button" data-open-tag="all">All tags</button>`,
    ...tagEntries.map((entry) => `<button class="tag-pill tag-pill-btn ${activeTagFilter === entry.key ? 'active' : ''}" type="button" data-open-tag="${escapeHtml(entry.label)}">#${escapeHtml(entry.label)} <span class="badge">${entry.count}</span></button>`)
  ].join('');

  const visibleRecords = activeTagFilter === 'all'
    ? filteredRecords
    : filteredRecords.filter((record) => record.tags.some((tag) => normalizeLookupName(tag) === activeTagFilter));

  if (!visibleRecords.length) {
    tagResultsGrid.innerHTML = '<p class="headmate-hint" style="margin:0">No profiles match that tag yet.</p>';
    return;
  }

  tagResultsGrid.innerHTML = visibleRecords.map((record) => {
    const subtitle = record.subtitle || `${record.tags.length} tag${record.tags.length === 1 ? '' : 's'} linked`;
    const fieldText = `${record.customFieldCount} custom field${record.customFieldCount === 1 ? '' : 's'}`;
    const disabledAttr = record.openable ? '' : ' disabled title="Sign into that account to open it directly."';
    return `
      <article class="tag-browser-card">
        <div class="tag-browser-card-head">
          <div class="tag-browser-main">
            ${renderAvatarMarkup(record.photo, record.name[0]?.toUpperCase() || '?', record.color || '#6c63ff', 'sm')}
            <div class="tag-browser-meta">
              <strong>${escapeHtml(record.name)}</strong>
              <span>${escapeHtml(record.type)} • ${escapeHtml(subtitle)}</span>
            </div>
          </div>
          <span class="badge">${escapeHtml(fieldText)}</span>
        </div>
        ${renderTagPills(record.tags.join(', '))}
        <div class="tag-browser-card-actions">
          <button class="btn-sm" type="button" data-tag-profile-module="${escapeHtml(record.module)}" data-tag-profile-key="${escapeHtml(record.key)}"${disabledAttr}>Open profile</button>
        </div>
      </article>
    `;
  }).join('');
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('.relation-link[data-nav-module][data-nav-key]');
  if (!link) return;
  event.preventDefault();
  event.stopPropagation();
  openProfileFromLink(link.dataset.navModule, link.dataset.navKey);
});

document.addEventListener('click', (event) => {
  const tagButton = event.target.closest('[data-open-tag]');
  if (!tagButton) return;
  event.preventDefault();
  event.stopPropagation();
  const rawTag = String(tagButton.dataset.openTag || 'all').trim();
  activeTagFilter = rawTag.toLowerCase() === 'all' ? 'all' : normalizeLookupName(rawTag);
  navigateTo('tags');
  renderTagsModule();
});

if (clearTagFilterBtn) {
  clearTagFilterBtn.addEventListener('click', () => {
    activeTagFilter = 'all';
    if (tagTypeFilter) tagTypeFilter.value = 'all';
    renderTagsModule();
  });
}

if (tagTypeFilter) {
  tagTypeFilter.addEventListener('change', () => renderTagsModule());
}

if (tagResultsGrid) {
  tagResultsGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tag-profile-module][data-tag-profile-key]');
    if (!button || button.hasAttribute('disabled')) return;
    openProfileFromLink(button.dataset.tagProfileModule || '', button.dataset.tagProfileKey || '');
  });
}

function normalizeHexColor(value, fallback = '#6c63ff') {
  const raw = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

function isMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return /^(https?:\/\/|data:image\/|blob:|\.\/|\/)/i.test(raw) || /\.(gif|png|jpe?g|webp|svg)(\?.*)?$/i.test(raw);
}

function escapeCssUrl(value) {
  return String(value || '').trim().replace(/'/g, '%27');
}

function applyPhotoStyle(el, value, fallbackText = '?', colorValue = '#6c63ff') {
  if (!el) return;
  const raw = String(value || '').trim();
  const fallback = String(fallbackText || '?').trim() || '?';
  const color = normalizeHexColor(colorValue, '#6c63ff');
  const hasMedia = isMediaUrl(raw);

  el.style.backgroundColor = color;
  if (hasMedia) {
    el.style.backgroundImage = `url('${escapeCssUrl(raw)}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.color = 'transparent';
    el.textContent = '';
    return;
  }

  el.style.backgroundImage = '';
  el.style.backgroundSize = '';
  el.style.backgroundPosition = '';
  el.style.backgroundRepeat = '';
  el.style.color = '';
  el.textContent = raw || fallback;
}

function renderAvatarMarkup(value, fallbackText = '?', colorValue = '#6c63ff', sizeClass = '') {
  const raw = String(value || '').trim();
  const fallback = String(fallbackText || '?').trim() || '?';
  const color = normalizeHexColor(colorValue, '#6c63ff');
  const hasMedia = isMediaUrl(raw);
  const className = ['avatar', sizeClass, hasMedia ? 'avatar-media' : ''].filter(Boolean).join(' ');
  const styleParts = [`background:${color}`];

  if (hasMedia) {
    styleParts.push(`background-image:url('${escapeCssUrl(raw)}')`, 'background-size:cover', 'background-position:center', 'background-repeat:no-repeat', 'color:transparent');
  }

  return `<div class="${className}" style="${styleParts.join(';')}">${hasMedia ? '' : escapeHtml(raw || fallback)}</div>`;
}

function renderTagPills(text, options = {}) {
  const tags = [...new Set(parseLinkedTextList(text).map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean))];
  if (!tags.length) return escapeHtml(String(text || 'Not set'));
  const clickable = options.clickable !== false;
  return `<div class="tag-pill-row">${tags.map((tag) => clickable
    ? `<button class="tag-pill tag-pill-btn" type="button" data-open-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`
    : `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join('')}</div>`;
}

function parseCustomFieldEntries(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)
    .filter((line) => !['not set', 'none', 'n/a'].includes(line.toLowerCase()))
    .map((line, index) => {
      const dividerIndex = line.search(/[:=]/);
      if (dividerIndex === -1) {
        return { label: `Custom ${index + 1}`, value: line.trim() };
      }

      return {
        label: line.slice(0, dividerIndex).trim() || `Custom ${index + 1}`,
        value: line.slice(dividerIndex + 1).trim() || 'Not set'
      };
    })
    .filter((entry) => entry.value && !['not set', 'none', 'n/a'].includes(entry.value.toLowerCase()));
}

function renderCustomFieldSummary(value) {
  const entries = parseCustomFieldEntries(value);
  if (!entries.length) return escapeHtml(String(value || 'Not set'));
  return `<span class="setting-value">${entries.length} custom profile field${entries.length === 1 ? '' : 's'} saved</span>`;
}

function renderInlineMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}

function renderMarkdown(text) {
  const raw = String(text ?? '');
  const normalized = raw.trim().toLowerCase();
  if (!raw.trim() || ['not set', 'none', 'n/a'].includes(normalized)) {
    return escapeHtml(raw || 'Not set');
  }

  const lines = raw.replace(/\r/g, '').split('\n');
  const blocks = [];
  let listBuffer = [];
  let listType = null;
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push(`<p>${paragraphBuffer.map((line) => renderInlineMarkdown(escapeHtml(line))).join('<br/>')}</p>`);
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    const tag = listType === 'ol' ? 'ol' : 'ul';
    blocks.push(`<${tag}>${listBuffer.map((item) => `<li>${renderInlineMarkdown(escapeHtml(item))}</li>`).join('')}</${tag}>`);
    listBuffer = [];
    listType = null;
  };

  lines.forEach((line) => {
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);

    if (unordered) {
      flushParagraph();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listBuffer.push(unordered[1]);
      return;
    }

    if (ordered) {
      flushParagraph();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listBuffer.push(ordered[1]);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    paragraphBuffer.push(line);
  });

  flushParagraph();
  flushList();

  return `<div class="markdown-content">${blocks.join('') || `<p>${renderInlineMarkdown(escapeHtml(raw)).replace(/\n/g, '<br/>')}</p>`}</div>`;
}

function renderCustomFieldArticles(profile, privacyValue = 'public') {
  return parseCustomFieldEntries(profile?.customFields).map((entry) => {
    const badge = privacyBadge(privacyValue);
    return `<article class="headmate-field headmate-field--custom"><span class="headmate-field-label">${escapeHtml(entry.label)}${badge}</span><div class="headmate-field-value">${renderMarkdown(entry.value)}</div></article>`;
  });
}

const MEDIA_FILE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
const MAX_MEDIA_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_EMBEDDED_IMAGE_BYTES = 350 * 1024;
const MAX_EMBEDDED_GIF_BYTES = 900 * 1024;
const MAX_SAFE_LOCAL_STATE_BYTES = 4 * 1024 * 1024;
const MAX_SAFE_REMOTE_STATE_BYTES = 12 * 1024 * 1024;
const ACCOUNT_STORAGE_BACKUP_KEY = 'ispd7.accounts.backup.v1';
const HUB_STATE_BACKUP_KEY = 'ispd7.hub.state.backup.v1';
let lastStorageWarningText = '';

function estimateStringBytes(value) {
  try {
    return new Blob([String(value || '')]).size;
  } catch (_err) {
    return String(value || '').length;
  }
}

function isEmbeddedMediaValue(value) {
  return /^data:image\//i.test(String(value || '').trim());
}

function getEmbeddedMediaByteLimit(value = '') {
  return /^data:image\/gif/i.test(String(value || '').trim()) ? MAX_EMBEDDED_GIF_BYTES : MAX_EMBEDDED_IMAGE_BYTES;
}

function createStorageMediaPlaceholder(keyHint = '') {
  return keyHint === 'profilePhoto' ? '' : 'Uploaded media omitted from compact backup';
}

function sanitizeEmbeddedMediaValue(value, fallback = '', options = {}) {
  const raw = String(value || '').trim();
  if (!isEmbeddedMediaValue(raw)) return raw || fallback;
  if (options.stripAllEmbeddedMedia) return fallback;
  return estimateStringBytes(raw) <= getEmbeddedMediaByteLimit(raw) ? raw : fallback;
}

function cloneForStorage(value, keyHint = '', options = {}) {
  if (typeof value === 'string') {
    if (!isEmbeddedMediaValue(value)) return value;
    return sanitizeEmbeddedMediaValue(value, createStorageMediaPlaceholder(keyHint), options);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => cloneForStorage(entry, keyHint, options));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const output = {};
  Object.entries(value).forEach(([key, entry]) => {
    output[key] = cloneForStorage(entry, key, options);
  });
  return output;
}

function buildStorageSafeClone(value, maxBytes = MAX_SAFE_LOCAL_STATE_BYTES, options = {}) {
  const fullValue = cloneForStorage(value, '', options);
  const fullSerialized = JSON.stringify(fullValue);
  if (estimateStringBytes(fullSerialized) <= maxBytes) {
    return { value: fullValue, serialized: fullSerialized, compacted: false };
  }

  const compactValue = cloneForStorage(value, '', { ...options, stripAllEmbeddedMedia: true });
  return {
    value: compactValue,
    serialized: JSON.stringify(compactValue),
    compacted: true
  };
}

function readStoredJsonWithBackup(primaryKey, backupKey = '', fallback = null) {
  const tryRead = (key) => {
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  };

  try {
    const primaryValue = tryRead(primaryKey);
    if (primaryValue !== null) return primaryValue;
  } catch (_err) {
    // Fall through to backup.
  }

  try {
    const backupValue = tryRead(backupKey);
    if (backupValue !== null) return backupValue;
  } catch (_err) {
    // Ignore malformed backup data too.
  }

  return fallback;
}

function writeStoredJsonWithBackup(primaryKey, backupKey, value, options = {}) {
  const maxBytes = Number(options.maxBytes || MAX_SAFE_LOCAL_STATE_BYTES) || MAX_SAFE_LOCAL_STATE_BYTES;
  const warningMessage = String(options.warningMessage || '').trim();
  const persistSerialized = (serializedText) => {
    localStorage.setItem(primaryKey, serializedText);
    if (backupKey) localStorage.setItem(backupKey, serializedText);
  };

  const attempt = buildStorageSafeClone(value, maxBytes);
  try {
    persistSerialized(attempt.serialized);
    if (attempt.compacted && warningMessage) showStorageWarning(warningMessage);
    return attempt;
  } catch (_err) {
    const fallbackAttempt = buildStorageSafeClone(value, Math.max(256 * 1024, Math.floor(maxBytes * 0.85)), { stripAllEmbeddedMedia: true });
    try {
      persistSerialized(fallbackAttempt.serialized);
    } catch (_secondaryErr) {
      if (warningMessage) showStorageWarning(warningMessage);
      return fallbackAttempt;
    }
    if (warningMessage) showStorageWarning(warningMessage);
    return fallbackAttempt;
  }
}

function showStorageWarning(message) {
  const text = String(message || '').trim();
  if (!text || lastStorageWarningText === text) return;
  lastStorageWarningText = text;
  window.setTimeout(() => {
    if (lastStorageWarningText === text) lastStorageWarningText = '';
  }, 2500);
  safeAlert(text);
}

function renderMediaInputControl({ label, id, value, placeholder = '', helperText = '' }) {
  const rawValue = String(value || '').trim();
  const hasEmbeddedImage = /^data:image\//i.test(rawValue);
  const displayValue = hasEmbeddedImage ? '[Uploaded image/GIF saved]' : rawValue;
  const mediaAttrs = hasEmbeddedImage
    ? ` data-media-value="${escapeHtml(rawValue)}" data-media-label="${escapeHtml(displayValue)}"`
    : '';

  return `
    <div class="media-input-field">
      <span class="media-input-label">${label}</span>
      <div class="media-input-row">
        <input class="setting-input" id="${id}" type="text" value="${escapeHtml(displayValue)}"${mediaAttrs}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''} />
        <label class="btn-sm media-upload-btn" title="Choose an image or GIF file">
          Upload File/GIF
          <input type="file" accept="${MEDIA_FILE_ACCEPT}" data-media-target="${id}" hidden />
        </label>
        <button class="btn-sm" type="button" data-clear-media-target="${id}">Clear</button>
      </div>
      ${helperText ? `<p class="field-helper">${helperText}</p>` : ''}
    </div>
  `;
}

function renderFieldInput(field, id, safeValue) {
  const placeholder = field.key === 'profilePhoto'
    ? 'Letter, uploaded file/GIF, or image URL'
    : field.key === 'banner'
      ? 'Banner text, uploaded file/GIF, or image URL'
      : field.key === 'linkedProfiles'
        ? 'Example: Headmate: Alex, Account: @friend, Account Alter: @friend / Nova'
        : field.key === 'linkedAlters'
          ? 'Comma-separated alter names'
          : field.key === 'partnerHeadmates'
            ? 'Example: Jun (Host), Mira (Protector)'
            : field.key === 'tags' || field.key === 'tag'
              ? 'Comma-separated tags like admin, comfort, fronting'
              : field.key === 'customFields'
                ? 'One field per line, like:\nPronouns: they/them\nComfort item: Lavender tea'
                : '';

  if (field.key === 'color') {
    const color = normalizeHexColor(safeValue, '#6c63ff');
    return `<label>${field.label}<div class="color-input-row"><input class="setting-input setting-input-color" id="${id}" type="color" value="${color}" /><span class="color-value-pill" data-color-value-for="${id}">${escapeHtml(color.toUpperCase())}</span></div></label>`;
  }
  if (field.key === 'profilePhoto' || field.key === 'banner') {
    const helperText = field.key === 'profilePhoto'
      ? 'Choose a local photo or GIF from your device, or paste an image URL. You can still type a letter if you prefer.'
      : 'Choose a local image or GIF from your device, or paste an image URL. You can also keep using banner text.';
    return renderMediaInputControl({
      label: field.label,
      id,
      value: safeValue,
      placeholder,
      helperText
    });
  }
  if (field.type === 'textarea') {
    const helper = field.key === 'customFields'
      ? `<p class="field-helper">Create actual profile fields here with one line per field in <code>Label: Value</code> format.</p><button class="btn-sm" type="button" data-add-custom-field="${id}">+ Add Field Row</button>`
      : '';
    return `<label>${field.label}<textarea class="setting-input" id="${id}"${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''}>${escapeHtml(String(safeValue || ''))}</textarea>${helper}</label>`;
  }
  if (field.key === 'folder') {
    return `<label>${field.label}<input class="setting-input" id="${id}" list="headmateFolderOptions" type="text" value="${escapeHtml(String(safeValue || ''))}" placeholder="e.g. Front Crew" /></label>`;
  }
  if (field.key === 'subfolder') {
    return `<label>${field.label}<input class="setting-input" id="${id}" list="headmateSubfolderOptions" type="text" value="${escapeHtml(String(safeValue || ''))}" placeholder="e.g. Protectors" /></label>`;
  }
  return `<label>${field.label}<input class="setting-input" id="${id}" type="text" value="${escapeHtml(String(safeValue || ''))}"${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''} /></label>`;
}

function syncColorValuePill(input, fallback = '#6c63ff') {
  if (!input) return;
  const color = normalizeHexColor(input.value, fallback);
  if (input.value !== color) input.value = color;

  const row = input.closest('.color-input-row');
  const pill = (row && input.id ? row.querySelector(`[data-color-value-for="${input.id}"]`) : null)
    || (input.id ? document.getElementById(`${input.id}Value`) : null);

  if (pill) pill.textContent = color.toUpperCase();
}

function getEditorInputValue(input) {
  return String(input?.dataset?.mediaValue ?? input?.value ?? '').trim();
}

function storeMediaInputValue(input, rawValue, labelText = '[Uploaded image/GIF saved]') {
  if (!input) return;
  const cleanValue = String(rawValue || '').trim();
  if (!cleanValue) {
    delete input.dataset.mediaValue;
    delete input.dataset.mediaLabel;
    input.value = '';
    return;
  }

  input.dataset.mediaValue = cleanValue;
  input.dataset.mediaLabel = labelText;
  input.dataset.settingMediaSyncing = 'true';
  input.value = labelText;
  delete input.dataset.settingMediaSyncing;
}

function primeStoredMediaInput(input, labelText = '[Uploaded image/GIF saved]') {
  if (!input) return;
  const raw = String(input.dataset.mediaValue || input.value || '').trim();
  delete input.dataset.mediaValue;
  delete input.dataset.mediaLabel;

  if (/^data:image\//i.test(raw)) {
    storeMediaInputValue(input, raw, labelText);
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not process that image.'));
    img.src = src;
  });
}

async function optimizeStaticImageDataUrl(dataUrl) {
  const img = await loadImageElement(dataUrl);
  const naturalWidth = img.naturalWidth || img.width || 1;
  const naturalHeight = img.naturalHeight || img.height || 1;
  const maxDimension = 900;
  const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));

  if (scale >= 0.999 && estimateStringBytes(dataUrl) <= MAX_EMBEDDED_IMAGE_BYTES) {
    return dataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) return dataUrl;

  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.82);
}

async function readFileAsDataUrl(file) {
  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

  if (/^image\/(png|jpe?g|webp)$/i.test(String(file?.type || ''))) {
    try {
      return await optimizeStaticImageDataUrl(rawDataUrl);
    } catch (_err) {
      return rawDataUrl;
    }
  }

  return rawDataUrl;
}

function enhanceMediaPickerInput(input, options = {}) {
  if (!input || input.dataset.mediaEnhanced === 'true' || !input.id || !input.parentNode) return;

  const kind = options.kind || 'photo';
  const helperText = options.helperText
    || (kind === 'banner'
      ? 'Choose a local image or GIF file or paste an image URL. You can also keep using banner text.'
      : 'Choose a local photo or GIF file or paste an image URL. You can still type a letter if you prefer.');

  const wrapper = document.createElement('div');
  wrapper.className = 'media-input-row';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const uploadLabel = document.createElement('label');
  uploadLabel.className = 'btn-sm media-upload-btn';
  uploadLabel.title = 'Choose an image or GIF file';
  uploadLabel.innerHTML = `Upload File/GIF<input type="file" accept="${MEDIA_FILE_ACCEPT}" data-media-target="${input.id}" hidden />`;

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'btn-sm';
  clearButton.dataset.clearMediaTarget = input.id;
  clearButton.textContent = 'Clear';

  wrapper.appendChild(uploadLabel);
  wrapper.appendChild(clearButton);

  const helper = document.createElement('p');
  helper.className = 'field-helper';
  helper.textContent = helperText;
  wrapper.insertAdjacentElement('afterend', helper);

  input.dataset.mediaEnhanced = 'true';
  primeStoredMediaInput(input);
}

function bindColorPickers(container) {
  if (!container) return;
  container.querySelectorAll('input[type="color"]').forEach((picker) => {
    syncColorValuePill(picker);
    if (picker.dataset.colorBound === 'true') return;

    picker.addEventListener('input', () => {
      syncColorValuePill(picker);
    });
    picker.addEventListener('change', () => {
      syncColorValuePill(picker);
    });
    picker.dataset.colorBound = 'true';
  });
}

document.addEventListener('click', (event) => {
  const clearMediaBtn = event.target.closest('[data-clear-media-target]');
  if (clearMediaBtn) {
    event.preventDefault();
    const target = document.getElementById(clearMediaBtn.dataset.clearMediaTarget || '');
    if (!target) return;
    delete target.dataset.mediaValue;
    delete target.dataset.mediaLabel;
    target.value = '';
    target.focus();
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  const addFieldBtn = event.target.closest('[data-add-custom-field]');
  if (!addFieldBtn) return;
  event.preventDefault();

  const target = document.getElementById(addFieldBtn.dataset.addCustomField || '');
  if (!target) return;

  const prefix = target.value.trim() ? `${target.value.trim()}\n` : '';
  target.value = `${prefix}New Field: `;
  target.focus();
  target.setSelectionRange(target.value.length, target.value.length);
});

document.addEventListener('change', async (event) => {
  const picker = event.target.closest('input[type="file"][data-media-target]');
  if (!picker) return;

  const [file] = Array.from(picker.files || []);
  if (!file) return;

  const target = document.getElementById(picker.dataset.mediaTarget || '');
  if (!target) return;

  if (!String(file.type || '').startsWith('image/')) {
    safeAlert('Please choose an image or GIF file.');
    picker.value = '';
    return;
  }

  if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
    safeAlert('Please choose an image or GIF under 2 MB.');
    picker.value = '';
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const maxEmbeddedBytes = /^image\/gif$/i.test(String(file.type || '')) ? MAX_EMBEDDED_GIF_BYTES : MAX_EMBEDDED_IMAGE_BYTES;
    if (estimateStringBytes(dataUrl) > maxEmbeddedBytes) {
      throw new Error('That file is too large to save safely. Please use a smaller image/GIF or paste an image URL instead.');
    }
    storeMediaInputValue(target, dataUrl, `[Uploaded] ${file.name}`);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (error) {
    safeAlert(error?.message || 'Could not read that file.');
  } finally {
    picker.value = '';
  }
});

function autoSizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(textarea.scrollHeight, 78)}px`;
}

function bindAutoGrowingTextareas(container = document) {
  if (!container) return;
  container.querySelectorAll('textarea.setting-input').forEach((textarea) => {
    autoSizeTextarea(textarea);
    if (textarea.dataset.autoGrowBound === 'true') return;

    textarea.addEventListener('input', () => autoSizeTextarea(textarea));
    textarea.dataset.autoGrowBound = 'true';
  });
}

document.addEventListener('input', (event) => {
  const input = event.target.closest('.setting-input[id]');
  if (!input || input.dataset.settingMediaSyncing === 'true') return;
  if (input.dataset.mediaValue && input.value !== input.dataset.mediaLabel) {
    delete input.dataset.mediaValue;
    delete input.dataset.mediaLabel;
  }

  if (input.matches('textarea.setting-input')) {
    autoSizeTextarea(input);
  }
});

function applyBannerStyle(el, bannerValue, colorValue, colorVarName = '--headmate-color') {
  if (!el) return;
  const banner = String(bannerValue || '').trim();
  const color = normalizeHexColor(colorValue, '#6c63ff');
  el.style.setProperty(colorVarName, color);
  el.title = banner;

  if (isMediaUrl(banner)) {
    el.style.backgroundImage = `linear-gradient(120deg, rgba(0,0,0,0.38), rgba(0,0,0,0.12)), url('${escapeCssUrl(banner)}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
  } else {
    el.style.backgroundImage = '';
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';
    el.style.backgroundRepeat = '';
  }
}

function renderHeadmateProfile(profile) {
  if (!headmateProfileGrid || !headmateProfilePanel) return;

  const headmatePhotoValue = profile.profilePhoto || 'H';
  applyPhotoStyle(headmatePhoto, headmatePhotoValue, profile.name?.[0] || 'H', profile.color || '#6c63ff');
  const folderPath = ensureHeadmateFolderPath(profile);
  headmateName.textContent = profile.name;
  headmateMeta.textContent = `${profile.pronouns || 'Pronouns TBD'} • ${profile.mainRole || 'No role set'} • ${folderPath.folder} / ${folderPath.subfolder}`;
  applyBannerStyle(headmateBanner, profile.banner, profile.color, '--headmate-color');

  const fp = profile.fieldPrivacy || {};
  const viewerLevel = getViewerTrustLevel();

  const baseHeadmateFields = headmateFieldSchema
    .filter((field) => field.key !== 'customFields' && canViewField(fp[field.key] || 'public', viewerLevel))
    .map((field) => {
      const value = renderProfileFieldValue('headmate', field, profile);
      const badge = privacyBadge(fp[field.key]);
      return `<article class="headmate-field"><span class="headmate-field-label">${escapeHtml(field.label)}${badge}</span><div class="headmate-field-value">${value}</div></article>`;
    });
  const headmateCustomFields = canViewField(fp.customFields || 'public', viewerLevel)
    ? renderCustomFieldArticles(profile, fp.customFields || 'public')
    : [];
  headmateProfileGrid.innerHTML = baseHeadmateFields.concat(headmateCustomFields).join('');

  headmateProfilePanel.hidden = false;
}

function renderHeadmatesTable() {
  if (!headmatesTableBody) return;

  const activeProfiles = getActiveHeadmateProfiles();
  const entries = Object.entries(activeProfiles);
  renderHeadmateFolderFilters();

  if (!entries.length) {
    headmatesTableBody.innerHTML = `<tr class="empty-headmates"><td colspan="4">No ${escapeHtml(getTermLabel('headmates').toLowerCase())} for this user yet.</td></tr>`;
    renderHeadmateFolderTree([]);
    selectedHeadmateKey = null;
    pendingHeadmateDraft = null;
    if (saveHeadmateBtn) saveHeadmateBtn.disabled = true;
    if (headmateProfilePanel) headmateProfilePanel.hidden = true;
    if (headmateEditor) headmateEditor.hidden = true;
    return;
  }

  const query = (headmatesSearchInput?.value || '').trim().toLowerCase();
  const folderFilter = headmateFolderFilter?.value || 'all';
  const subfolderFilter = headmateSubfolderFilter?.value || 'all';

  const filtered = entries
    .map(([key, profile]) => {
      const path = ensureHeadmateFolderPath(profile);
      return [key, profile, path];
    })
    .filter(([, profile, path]) => {
      const matchesQuery = !query || [profile.name, profile.mainRole, profile.nickname, profile.tags, path.folder, path.subfolder]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesFolder = folderFilter === 'all' || normalizeLookupName(path.folder) === normalizeLookupName(folderFilter);
      const matchesSubfolder = subfolderFilter === 'all' || normalizeLookupName(path.subfolder) === normalizeLookupName(subfolderFilter);
      return matchesQuery && matchesFolder && matchesSubfolder;
    })
    .sort((a, b) => {
      const folderDiff = a[2].folder.localeCompare(b[2].folder);
      if (folderDiff) return folderDiff;
      const subDiff = a[2].subfolder.localeCompare(b[2].subfolder);
      if (subDiff) return subDiff;
      return String(a[1].name || '').localeCompare(String(b[1].name || ''));
    });

  renderHeadmateFolderTree(entries);

  if (!filtered.length) {
    headmatesTableBody.innerHTML = `<tr class="empty-headmates"><td colspan="4">No ${escapeHtml(getTermLabel('headmates').toLowerCase())} match the current search or folder filter.</td></tr>`;
    selectedHeadmateKey = null;
    pendingHeadmateDraft = null;
    if (headmateProfilePanel) headmateProfilePanel.hidden = true;
    if (headmateEditor) headmateEditor.hidden = true;
    if (saveHeadmateBtn) saveHeadmateBtn.disabled = true;
    return;
  }

  let currentGroup = '';
  let visibleIndex = 0;
  headmatesTableBody.innerHTML = filtered.map(([key, profile, path]) => {
    visibleIndex += 1;
    const groupLabel = `${path.folder} / ${path.subfolder}`;
    const groupRow = currentGroup !== groupLabel
      ? `<tr class="folder-row"><td colspan="4">📁 ${escapeHtml(path.folder)} <span>/ ${escapeHtml(path.subfolder)}</span></td></tr>`
      : '';
    currentGroup = groupLabel;
    return `${groupRow}
      <tr data-headmate="${key}" class="${selectedHeadmateKey === key ? 'selected' : ''}">
        <td>#${String(visibleIndex).padStart(3, '0')}</td>
        <td>${escapeHtml(profile.name)}</td>
        <td>${escapeHtml(profile.mainRole || 'No role set')}</td>
        <td>${escapeHtml(groupLabel)}</td>
      </tr>`;
  }).join('');

  const selectedStillVisible = filtered.some(([key]) => key === selectedHeadmateKey);
  if (selectedHeadmateKey && activeProfiles[selectedHeadmateKey] && selectedStillVisible) {
    renderHeadmateProfile(activeProfiles[selectedHeadmateKey]);
  } else {
    selectedHeadmateKey = null;
    pendingHeadmateDraft = null;
    if (saveHeadmateBtn) saveHeadmateBtn.disabled = true;
    if (headmateProfilePanel) headmateProfilePanel.hidden = true;
    if (headmateEditor) headmateEditor.hidden = true;
  }
}

if (headmatesTableBody) {
  headmatesTableBody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-headmate]');
    if (!row) return;

    const key = row.dataset.headmate;
    const activeProfiles = getActiveHeadmateProfiles();
    const profile = activeProfiles[key];
    if (!profile) return;

    document.querySelectorAll('#page-parts tbody tr[data-headmate]').forEach((other) => other.classList.remove('selected'));
    row.classList.add('selected');
    selectedHeadmateKey = key;
    pendingHeadmateDraft = null;
    if (saveHeadmateBtn) saveHeadmateBtn.disabled = true;
    renderHeadmateProfile(profile);
    headmateProfilePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (headmatesSearchInput) {
  headmatesSearchInput.addEventListener('input', renderHeadmatesTable);
}

if (headmateFolderFilter) {
  headmateFolderFilter.addEventListener('change', () => {
    renderHeadmateFolderFilters();
    renderHeadmatesTable();
  });
}

if (headmateSubfolderFilter) {
  headmateSubfolderFilter.addEventListener('change', renderHeadmatesTable);
}

if (manageHeadmateFoldersBtn) {
  manageHeadmateFoldersBtn.addEventListener('click', () => {
    const raw = safePrompt('Create or register a folder path using Folder or Folder/Subfolder:', 'Front Crew/Protectors');
    if (!raw || !raw.trim()) return;
    const [folderPart, subfolderPart] = raw.split('/').map((part) => part.trim()).filter(Boolean);
    const folderName = normalizeFolderName(folderPart, 'Unsorted');
    const subfolderName = normalizeSubfolderName(subfolderPart, 'General');
    const folders = getActiveHeadmateFolders();
    let folder = folders.find((item) => normalizeLookupName(item.name) === normalizeLookupName(folderName));
    if (!folder) {
      folder = { name: folderName, subfolders: [] };
      folders.push(folder);
    }
    if (!folder.subfolders.some((item) => normalizeLookupName(item) === normalizeLookupName(subfolderName))) {
      folder.subfolders.push(subfolderName);
    }
    renderHeadmatesTable();
    safeAlert(`Saved folder path: ${folderName} / ${subfolderName}`);
  });
}

if (headmateFolderTree) {
  headmateFolderTree.addEventListener('click', (event) => {
    const button = event.target.closest('[data-folder-filter]');
    if (!button) return;
    if (headmateFolderFilter) headmateFolderFilter.value = button.dataset.folderFilter || 'all';
    renderHeadmateFolderFilters();
    if (headmateSubfolderFilter) headmateSubfolderFilter.value = button.dataset.subfolderFilter || 'all';
    renderHeadmatesTable();
  });
}

if (linkHeadmateSubsystemBtn) {
  linkHeadmateSubsystemBtn.addEventListener('click', () => {
    const profiles = getActiveHeadmateProfiles();
    const subsystems = getActiveSubsystems();
    if (!selectedHeadmateKey || !profiles[selectedHeadmateKey]) {
      safeAlert('Select a headmate first.');
      return;
    }
    const subsystemEntries = Object.entries(subsystems);
    if (!subsystemEntries.length) {
      safeAlert('Create a subsystem first so there is something to link.');
      return;
    }

    const names = subsystemEntries.map(([, subsystem]) => subsystem.name).join(', ');
    const rawName = safePrompt(`Enter the subsystem name to link. Available: ${names}`, subsystemEntries[0][1].name);
    if (!rawName || !rawName.trim()) return;

    const subsystemKey = findSubsystemKeyByName(rawName);
    if (!subsystemKey || !subsystems[subsystemKey]) {
      safeAlert('No matching subsystem was found.');
      return;
    }

    const profile = profiles[selectedHeadmateKey];
    const subsystem = subsystems[subsystemKey];
    profile.subsystem = appendCommaLinkValue(profile.subsystem, subsystem.name);
    if (!Array.isArray(subsystem.linkedHeadmates)) subsystem.linkedHeadmates = [];
    if (!subsystem.linkedHeadmates.includes(selectedHeadmateKey)) {
      subsystem.linkedHeadmates.push(selectedHeadmateKey);
    }

    renderHeadmatesTable();
    renderHeadmateProfile(profile);
    renderSubsystemsGrid();
    if (selectedSubsystemKey === subsystemKey) renderSubsystemProfile(subsystemKey);
  });
}

if (linkHeadmateProfileBtn) {
  linkHeadmateProfileBtn.addEventListener('click', () => {
    const profiles = getActiveHeadmateProfiles();
    if (!selectedHeadmateKey || !profiles[selectedHeadmateKey]) {
      safeAlert('Select a headmate first.');
      return;
    }
    const profile = profiles[selectedHeadmateKey];
    if (addProfileLinkToRecord(profile, 'Partner')) {
      renderHeadmatesTable();
      renderHeadmateProfile(profile);
    }
  });
}

renderHeadmatesTable();

function slugifyHeadmateName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `headmate-${Date.now()}`;
}

function normalizeStatus(status) {
  const safe = String(status || '').trim().toLowerCase();
  if (safe === 'active') return 'Active';
  if (safe === 'inactive') return 'Inactive';
  return 'Pending';
}

function createDefaultHeadmateProfile(name, region, status) {
  const initial = name[0]?.toUpperCase() || '?';
  const colors = ['#6c63ff', '#ff6584', '#43d9ad', '#f5a623', '#a29bfe', '#fd79a8', '#0984e3', '#e17055'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  return {
    profilePhoto: initial,
    banner: `${name} Banner`,
    color,
    interactionStatus: status === 'Active' ? 'Open to interaction' : 'Limited interaction',
    twsCws: 'Not set',
    byi: 'Not set',
    dni: 'Not set',
    name,
    nickname: 'Not set',
    alias: 'Not set',
    petnames: 'Not set',
    pronouns: 'Not set',
    gender: 'Not set',
    orientation: 'Not set',
    amory: 'Not set',
    partnershipStatus: 'Not set',
    partners: 'Not set',
    searching: 'Not set',
    verbality: 'Not set',
    aacUsage: 'Not set',
    toneTagUsage: 'Not set',
    age: 'Not set',
    ageType: 'Not set',
    birthdayRelative: 'Not set',
    species: 'Not set',
    regressor: false,
    regressionNotes: 'Not set',
    caregiver: false,
    caregiverNotes: 'Not set',
    mainRole: region,
    folder: 'Unsorted',
    subfolder: 'General',
    tags: 'Not set',
    customFields: 'Not set',
    otherRoles: 'Not set',
    partType: 'Not set',
    triggersPositive: 'Not set',
    triggersNeutral: 'Not set',
    triggersNegative: 'Not set',
    systemGroups: 'Not set',
    sidesystem: 'Not set',
    subsystem: 'Not set',
    linkedProfiles: 'Not set',
    formationDate: 'Not set',
    formationReason: 'Not set',
    formationNotes: 'Not set',
    sourceDetails: 'Not set',
    sexual: false,
    boundariesHard: 'Not set',
    boundariesSoft: 'Not set',
    boundariesGreen: 'Not set'
  };
}

if (addHeadmateBtn && headmatesTableBody) {
  addHeadmateBtn.addEventListener('click', () => {
    if (!canCreateHeadmates(1)) return;
    creatingHeadmate = true;
    selectedHeadmateKey = null;
    pendingHeadmateDraft = null;
    if (saveHeadmateBtn) saveHeadmateBtn.disabled = false;

    document.querySelectorAll('#page-parts tbody tr[data-headmate]').forEach((other) => other.classList.remove('selected'));

    const defaultName = `Headmate ${Object.keys(getActiveHeadmateProfiles()).length + 1}`;
    const seedProfile = createDefaultHeadmateProfile(defaultName, 'Support', 'Pending');
    renderHeadmateProfile(seedProfile);
    renderHeadmateEditorFields(seedProfile);

    if (headmateProfilePanel) headmateProfilePanel.hidden = false;
    if (headmateEditor) {
      headmateEditor.hidden = false;
      headmateEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (addHeadmateFromTemplateBtn && headmatesTableBody) {
  addHeadmateFromTemplateBtn.addEventListener('click', () => {
    if (!canCreateHeadmates(1)) return;
    const template = pickTemplateForTarget('headmate');
    if (!template) return;
    creatingHeadmate = true;
    selectedHeadmateKey = null;
    pendingHeadmateDraft = null;
    if (saveHeadmateBtn) saveHeadmateBtn.disabled = false;

    document.querySelectorAll('#page-parts tbody tr[data-headmate]').forEach((other) => other.classList.remove('selected'));

    const baseName = (template.name || '').trim() || `Headmate ${Object.keys(getActiveHeadmateProfiles()).length + 1}`;
    const seedProfile = {
      ...createDefaultHeadmateProfile(baseName, template.category || 'Support', 'Pending'),
      name: baseName,
      mainRole: template.category || 'Support',
      tags: template.category || 'Not set',
      customFields: template.defaultContent || 'Not set',
      byi: template.defaultContent || 'Not set',
      banner: template.banner || `${baseName} Banner`,
      color: template.color || '#6c63ff',
      profilePhoto: baseName[0]?.toUpperCase() || 'H'
    };
    renderHeadmateProfile(seedProfile);
    renderHeadmateEditorFields(seedProfile);

    if (headmateProfilePanel) headmateProfilePanel.hidden = false;
    if (headmateEditor) {
      headmateEditor.hidden = false;
      headmateEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (editHeadmateBtn) {
  editHeadmateBtn.addEventListener('click', () => {
    const activeProfiles = getActiveHeadmateProfiles();
    if (!selectedHeadmateKey || !activeProfiles[selectedHeadmateKey]) {
      safeAlert('Select a headmate first.');
      return;
    }

    const profile = activeProfiles[selectedHeadmateKey];
    renderHeadmateEditorFields(profile);

    if (headmateEditor) {
      headmateEditor.hidden = false;
      headmateEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    creatingHeadmate = false;
    saveHeadmateBtn.disabled = false;
  });
}

if (saveHeadmateBtn) {
  saveHeadmateBtn.addEventListener('click', () => {
    const activeProfiles = getActiveHeadmateProfiles();
    const profileToRead = creatingHeadmate
      ? createDefaultHeadmateProfile('Headmate', 'Support', 'Pending')
      : activeProfiles[selectedHeadmateKey];

    if (!profileToRead) return;

    const updatedDraft = readHeadmateEditorValues(profileToRead);
    const nameFromForm = (updatedDraft.name || '').trim();
    if (!nameFromForm) {
      safeAlert('Name is required.');
      return;
    }

    let profile;

    if (creatingHeadmate) {
      if (!canCreateHeadmates(1)) return;
      const role = (updatedDraft.mainRole || '').trim() || 'Support';
      const baseKey = slugifyHeadmateName(nameFromForm);
      let key = baseKey;
      let suffix = 2;
      while (activeProfiles[key]) {
        key = `${baseKey}-${suffix}`;
        suffix += 1;
      }

      activeProfiles[key] = createDefaultHeadmateProfile(nameFromForm, role, 'Pending');
      selectedHeadmateKey = key;
      profile = activeProfiles[key];
    } else {
      if (!selectedHeadmateKey) return;
      profile = activeProfiles[selectedHeadmateKey];
      if (!profile) return;
    }

    pendingHeadmateDraft = updatedDraft;

    Object.assign(profile, pendingHeadmateDraft);
    pendingHeadmateDraft = null;
    creatingHeadmate = false;
    saveHeadmateBtn.disabled = true;
    if (headmateEditor) headmateEditor.hidden = true;

    renderHeadmatesTable();
    if (typeof renderChatSidebar === 'function') renderChatSidebar();
    renderHeadmateProfile(profile);
  });
}

if (deleteHeadmateBtn) {
  deleteHeadmateBtn.addEventListener('click', () => {
    const activeProfiles = getActiveHeadmateProfiles();
    if (!selectedHeadmateKey || !activeProfiles[selectedHeadmateKey]) {
      safeAlert('Select a headmate first.');
      return;
    }

    const profile = activeProfiles[selectedHeadmateKey];
    if (!safeConfirm(`Delete headmate ${profile.name}?`)) return;

    delete activeProfiles[selectedHeadmateKey];
    selectedHeadmateKey = null;
    pendingHeadmateDraft = null;
    creatingHeadmate = false;
    if (saveHeadmateBtn) saveHeadmateBtn.disabled = true;
    headmateProfilePanel.hidden = true;
    renderHeadmatesTable();
    if (typeof renderChatSidebar === 'function') renderChatSidebar();
  });
}

function bulkAddHeadmatesFromList(rawText = '') {
  const entries = String(rawText || '')
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed) return [];
      if (trimmed.includes('|')) return [trimmed];
      return trimmed.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
    });

  if (!entries.length) return { addedCount: 0, skippedCount: 0 };

  const remainingCapacity = Math.max(0, MAX_HEADMATES_PER_ACCOUNT - getTotalHeadmateCountForAccount());
  if (!remainingCapacity) {
    canCreateHeadmates(1);
    return { addedCount: 0, skippedCount: entries.length };
  }

  const activeProfiles = getActiveHeadmateProfiles();
  let addedCount = 0;
  let skippedCount = 0;

  entries.forEach((entry) => {
    if (addedCount >= remainingCapacity) {
      skippedCount += 1;
      return;
    }

    const [rawName, rawRegion, rawStatus] = String(entry).split('|').map((part) => (part || '').trim());
    if (!rawName) {
      skippedCount += 1;
      return;
    }

    const name = rawName;
    const region = rawRegion || 'No role set';
    const status = normalizeStatus(rawStatus);

    const baseKey = slugifyHeadmateName(name);
    let key = baseKey;
    let suffix = 2;
    while (activeProfiles[key]) {
      key = `${baseKey}-${suffix}`;
      suffix += 1;
    }

    activeProfiles[key] = createDefaultHeadmateProfile(name, region, status);
    addedCount += 1;
  });

  return { addedCount, skippedCount };
}

if (bulkAddHeadmatesBtn && headmatesTableBody) {
  bulkAddHeadmatesBtn.addEventListener('click', () => {
    const raw = safePrompt(
      'Bulk add headmates from a list. Paste one per line, a comma-separated list, or use Name|Role|Status.\\nExamples:\\nNova\\nEmber\\nSky\\n\\nor\\nNova|Core|Active\\nEmber|Support|Pending'
    , 'Nova\nEmber\nSky');

    if (!raw) return;

    const result = bulkAddHeadmatesFromList(raw);
    if (result.addedCount > 0) {
      renderHeadmatesTable();
      if (typeof renderChatSidebar === 'function') renderChatSidebar();
      if (typeof scheduleHubStatePersist === 'function') scheduleHubStatePersist();
      safeAlert(`Added ${result.addedCount} headmate${result.addedCount === 1 ? '' : 's'}${result.skippedCount ? `, skipped ${result.skippedCount} because this account can only hold ${MAX_HEADMATES_PER_ACCOUNT} total.` : '.'}`);
    }
  });
}

// =====================
// Security: HTML Escape
// =====================
function escapeHtml(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =====================
// Innerworld: Locations database
// =====================
const locationsSearch = document.getElementById('locationsSearch');
const locationsTableBody = document.getElementById('locationsTableBody');
const addLocationBtn = document.getElementById('addLocationBtn');
const addLocationFromTemplateBtn = document.getElementById('addLocationFromTemplateBtn');
const locationProfile = document.getElementById('locationProfile');
const locationBanner = document.getElementById('locationBanner');
const locationPhoto = document.getElementById('locationPhoto');
const locationName = document.getElementById('locationName');
const locationMeta = document.getElementById('locationMeta');
const locationProfileGrid = document.getElementById('locationProfileGrid');
const editLocationBtn = document.getElementById('editLocationBtn');
const linkLocationProfileBtn = document.getElementById('linkLocationProfileBtn');
const saveLocationBtn = document.getElementById('saveLocationBtn');
const deleteLocationBtn = document.getElementById('deleteLocationBtn');
const locationEditor = document.getElementById('locationEditor');
const locationEditorFields = document.getElementById('locationEditorFields');
const locationSublocationList = document.getElementById('locationSublocationList');
const linkSublocationBtn = document.getElementById('linkSublocationBtn');
const sublocationLinkPicker = document.getElementById('sublocationLinkPicker');
const sublocationLinkSelect = document.getElementById('sublocationLinkSelect');
const sublocationLinkConfirmBtn = document.getElementById('sublocationLinkConfirmBtn');
const sublocationLinkCancelBtn = document.getElementById('sublocationLinkCancelBtn');
const locationMapCanvas = document.getElementById('locationMapCanvas');
const refreshLocationMapBtn = document.getElementById('refreshLocationMapBtn');

const locationFieldSchema = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'tags', label: 'Tags' },
  { key: 'customFields', label: 'Custom fields', type: 'textarea' },
  { key: 'associatedAlters', label: 'Associated alters' },
  { key: 'connectedLocations', label: 'Connected locations' },
  { key: 'linkedProfiles', label: 'Linked profiles' },
  { key: 'profilePhoto', label: 'Profile photo' },
  { key: 'banner', label: 'Banner' },
  { key: 'color', label: 'Color' }
];

const locationProfiles = {};

let selectedLocationKey = null;
let creatingLocation = false;

function createDefaultLocation(name) {
  const colors = ['#6c63ff', '#ff6584', '#43d9ad', '#f5a623', '#a29bfe', '#fd79a8', '#0984e3', '#e17055'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return {
    name,
    type: 'Other',
    description: 'Not set',
    tags: 'Not set',
    customFields: 'Not set',
    associatedAlters: 'Not set',
    connectedLocations: 'Not set',
    linkedProfiles: 'Not set',
    sublocations: [],
    profilePhoto: name[0]?.toUpperCase() || 'L',
    banner: `${name} Banner`,
    color
  };
}

function renderSublocationList(profile) {
  if (!locationSublocationList) return;
  const sublocationKeys = profile.sublocations || [];
  if (!sublocationKeys.length) {
    locationSublocationList.innerHTML = '<p class="headmate-hint" style="margin:8px 0">No sublocations linked yet.</p>';
    return;
  }

  locationSublocationList.innerHTML = sublocationKeys.map((key) => {
    const location = locationProfiles[key];
    if (!location) return '';
    return `
      <div class="subsystem-hub-member" data-sublocation-key="${key}">
        ${renderAvatarMarkup(location.profilePhoto || location.name?.[0]?.toUpperCase() || 'L', location.name?.[0]?.toUpperCase() || 'L', location.color || '#6c63ff', 'sm')}
        <div class="subsystem-hub-member-info">
          <strong>${escapeHtml(location.name)}</strong>
          <span>${escapeHtml(location.type || 'Other')}</span>
        </div>
        <button class="btn-sm subsystem-unlink-btn" type="button" data-unlink-sublocation-key="${key}" title="Unlink">&#10005;</button>
      </div>
    `;
  }).filter(Boolean).join('');
}

function renderLocationEditorFields(profile) {
  if (!locationEditorFields) return;
  const fp = profile.fieldPrivacy || {};
  locationEditorFields.innerHTML = locationFieldSchema.map((field) => {
    const id = `locationEdit_${field.key}`;
    const safeValue = String(profile[field.key] ?? '');
    const privSel = renderPrivacySelect(`priv_locationEdit_${field.key}`, fp[field.key] || 'public');
    const inputHtml = renderFieldInput(field, id, safeValue);
    return `<div class="editor-field-row">${inputHtml}${privSel}</div>`;
  }).join('');

  bindColorPickers(locationEditorFields);
  bindAutoGrowingTextareas(locationEditorFields);
}

function readLocationEditorValues(base) {
  const updated = { ...base };
  locationFieldSchema.forEach((field) => {
    const el = document.getElementById(`locationEdit_${field.key}`);
    if (!el) return;
    const value = getEditorInputValue(el);
    updated[field.key] = value || (base[field.key] ?? 'Not set');
  });
  updated.fieldPrivacy = readFieldPrivacy(locationFieldSchema, 'locationEdit', base);
  return updated;
}

function renderLocationProfile(profile) {
  if (!locationProfile || !locationProfileGrid) return;
  const photo = profile.profilePhoto || 'L';
  applyPhotoStyle(locationPhoto, photo, profile.name?.[0] || 'L', profile.color || '#6c63ff');
  applyBannerStyle(locationBanner, profile.banner, profile.color || '#6c63ff', '--headmate-color');
  locationName.textContent = profile.name;
  locationMeta.textContent = `${profile.type || 'Other'} • ${profile.connectedLocations || 'No linked locations'}`;

  const fpL = profile.fieldPrivacy || {};
  const viewerLevelL = getViewerTrustLevel();
  const baseLocationFields = locationFieldSchema
    .filter((field) => field.key !== 'customFields' && canViewField(fpL[field.key] || 'public', viewerLevelL))
    .map((field) => {
      const value = renderProfileFieldValue('location', field, profile);
      const badge = privacyBadge(fpL[field.key]);
      return `<article class="headmate-field"><span class="headmate-field-label">${escapeHtml(field.label)}${badge}</span><div class="headmate-field-value">${value}</div></article>`;
    });
  const locationCustomFields = canViewField(fpL.customFields || 'public', viewerLevelL)
    ? renderCustomFieldArticles(profile, fpL.customFields || 'public')
    : [];
  locationProfileGrid.innerHTML = baseLocationFields.concat(locationCustomFields).join('');

  renderSublocationList(profile);
  renderLocationMap(selectedLocationKey);
  locationProfile.hidden = false;
}

function getLocationLinkKeys(profile) {
  const textLinks = String(profile?.connectedLocations || '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name && !['not set', 'none', 'n/a'].includes(name.toLowerCase()))
    .map((name) => findLocationKeyByName(name))
    .filter(Boolean);

  const sublocationKeys = (profile?.sublocations || []).filter((key) => locationProfiles[key]);
  return Array.from(new Set([...textLinks, ...sublocationKeys]));
}

function renderLocationMap(activeKey = selectedLocationKey) {
  if (!locationMapCanvas) return;

  const entries = Object.entries(locationProfiles);
  if (!entries.length) {
    locationMapCanvas.innerHTML = '<div class="headmate-hint" style="padding:14px">Add locations to generate the innerworld map.</div>';
    return;
  }

  const centerKey = locationProfiles[activeKey] ? activeKey : entries[0][0];
  const centerProfile = locationProfiles[centerKey];
  const width = Math.max(760, locationMapCanvas.clientWidth || 760);
  const height = 420;
  const centerX = width * 0.23;
  const centerY = height * 0.5;

  const connectedKeys = String(centerProfile?.connectedLocations || '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name && !['not set', 'none', 'n/a'].includes(name.toLowerCase()))
    .map((name) => findLocationKeyByName(name))
    .filter(Boolean);
  const sublocationKeys = (centerProfile?.sublocations || []).filter((key) => locationProfiles[key]);
  const relatedSet = new Set([...connectedKeys, ...sublocationKeys]);
  const nearbyKeys = entries.map(([key]) => key).filter((key) => key !== centerKey && !relatedSet.has(key));

  const layoutColumn = (keys, x, startY, endY) => keys.map((key, index) => {
    const y = keys.length <= 1 ? (startY + endY) / 2 : startY + ((endY - startY) * index) / (keys.length - 1);
    return {
      key,
      label: locationProfiles[key]?.name || key,
      x,
      y,
      color: locationProfiles[key]?.color || '#6c63ff'
    };
  });

  const connectedNodes = layoutColumn(connectedKeys, width * 0.62, 86, height * 0.36);
  const sublocationNodes = layoutColumn(sublocationKeys, width * 0.62, height * 0.60, height * 0.84);
  const nearbyNodes = layoutColumn(nearbyKeys, width * 0.86, 90, height * 0.82);

  const buildNode = (node, radius, extraClass = '') => {
    const shortLabel = node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label;
    return `
      <g class="location-map-node ${extraClass}" data-map-location-key="${node.key}" tabindex="0">
        <circle cx="${node.x}" cy="${node.y}" r="${radius}" fill="${escapeHtml(node.color)}"></circle>
        <text class="location-map-node-label" x="${node.x}" y="${node.y + radius + 16}">${escapeHtml(shortLabel)}</text>
      </g>
    `;
  };

  const edgeMarkup = [
    ...connectedNodes.map((node) => `
      <path class="location-map-edge" d="M ${centerX + 42} ${centerY - 8} C ${centerX + 120} ${centerY - 8}, ${node.x - 110} ${node.y}, ${node.x - 34} ${node.y}" />
    `),
    ...sublocationNodes.map((node) => `
      <path class="location-map-edge location-map-edge--sub" d="M ${centerX + 42} ${centerY + 12} C ${centerX + 120} ${centerY + 12}, ${node.x - 110} ${node.y}, ${node.x - 34} ${node.y}" />
    `)
  ].join('');

  const subtitleParts = [];
  subtitleParts.push(`${connectedKeys.length} connected location${connectedKeys.length === 1 ? '' : 's'}`);
  subtitleParts.push(`${sublocationKeys.length} sublocation${sublocationKeys.length === 1 ? '' : 's'}`);
  if (nearbyKeys.length) subtitleParts.push(`${nearbyKeys.length} nearby saved`);

  locationMapCanvas.innerHTML = `
    <svg class="partners-diagram-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Innerworld location map">
      <text class="location-map-section-label" x="${centerX - 20}" y="34">Focused Location</text>
      ${connectedNodes.length ? `<text class="location-map-section-label" x="${width * 0.52}" y="34">Connected Locations</text>` : ''}
      ${sublocationNodes.length ? `<text class="location-map-section-label" x="${width * 0.52}" y="${height * 0.53}">Sublocations</text>` : ''}
      ${nearbyNodes.length ? `<text class="location-map-section-label" x="${width * 0.80}" y="34">Nearby Saved Locations</text>` : ''}
      ${edgeMarkup}
      ${buildNode({ key: centerKey, label: centerProfile.name, x: centerX, y: centerY, color: centerProfile.color || '#6c63ff' }, 34, 'selected')}
      ${connectedNodes.map((node) => buildNode(node, 26, 'linked')).join('')}
      ${sublocationNodes.map((node) => buildNode(node, 24, 'linked sublocation')).join('')}
      ${nearbyNodes.map((node) => buildNode(node, 20, 'nearby')).join('')}
    </svg>
    <div class="location-map-legend">
      <strong>Focused location:</strong> ${escapeHtml(centerProfile.name)}
      <span>${escapeHtml(subtitleParts.join(' • '))}</span>
    </div>
  `;
}

function renderLocationsTable(filterValue = '') {
  if (!locationsTableBody) return;
  const entries = Object.entries(locationProfiles);
  const query = filterValue.trim().toLowerCase();
  const filtered = query
    ? entries.filter(([, profile]) =>
      profile.name.toLowerCase().includes(query) ||
      (profile.type || '').toLowerCase().includes(query) ||
      (profile.tags || '').toLowerCase().includes(query)
    )
    : entries;

  locationsTableBody.innerHTML = filtered.length
    ? filtered.map(([key, profile], index) => `
      <tr data-location="${key}" class="${selectedLocationKey === key ? 'selected' : ''}">
        <td>#${String(index + 1).padStart(3, '0')}</td>
        <td>${escapeHtml(profile.name)}</td>
        <td>${escapeHtml(profile.type || 'Other')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="3">No locations found.</td></tr>';

  if (selectedLocationKey && locationProfiles[selectedLocationKey]) {
    renderLocationProfile(locationProfiles[selectedLocationKey]);
  } else {
    if (locationProfile) locationProfile.hidden = true;
    if (locationEditor) locationEditor.hidden = true;
    if (saveLocationBtn) saveLocationBtn.disabled = true;
    renderLocationMap(selectedLocationKey);
  }
}

if (locationsTableBody) {
  locationsTableBody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-location]');
    if (!row) return;
    const key = row.dataset.location;
    const profile = locationProfiles[key];
    if (!profile) return;

    document.querySelectorAll('#locationsTableBody tr[data-location]').forEach((r) => r.classList.remove('selected'));
    row.classList.add('selected');
    selectedLocationKey = key;
    creatingLocation = false;
    if (saveLocationBtn) saveLocationBtn.disabled = true;
    if (locationEditor) locationEditor.hidden = true;
    if (sublocationLinkPicker) sublocationLinkPicker.hidden = true;
    renderLocationProfile(profile);
  });
}

if (locationsSearch) {
  locationsSearch.addEventListener('input', () => renderLocationsTable(locationsSearch.value));
}

if (addLocationBtn) {
  addLocationBtn.addEventListener('click', () => {
    creatingLocation = true;
    selectedLocationKey = null;
    const defaultName = `Location ${Object.keys(locationProfiles).length + 1}`;
    const seed = createDefaultLocation(defaultName);
    renderLocationProfile(seed);
    renderLocationEditorFields(seed);
    if (saveLocationBtn) saveLocationBtn.disabled = false;
    if (locationSublocationList) locationSublocationList.innerHTML = '';
    if (sublocationLinkPicker) sublocationLinkPicker.hidden = true;
    if (locationEditor) {
      locationEditor.hidden = false;
      locationEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (addLocationFromTemplateBtn) {
  addLocationFromTemplateBtn.addEventListener('click', () => {
    const template = pickTemplateForTarget('location');
    if (!template) return;
    creatingLocation = true;
    selectedLocationKey = null;
    const baseName = (template.name || '').trim() || `Location ${Object.keys(locationProfiles).length + 1}`;
    const seed = {
      ...createDefaultLocation(baseName),
      name: baseName,
      type: template.category || 'Other',
      description: template.description || 'Not set',
      tags: template.category || 'Not set',
      customFields: template.defaultContent || 'Not set',
      associatedAlters: template.defaultContent || 'Not set',
      banner: template.banner || `${baseName} Banner`,
      color: template.color || '#6c63ff',
      profilePhoto: baseName[0]?.toUpperCase() || 'L'
    };
    renderLocationProfile(seed);
    renderLocationEditorFields(seed);
    if (saveLocationBtn) saveLocationBtn.disabled = false;
    if (locationSublocationList) locationSublocationList.innerHTML = '';
    if (sublocationLinkPicker) sublocationLinkPicker.hidden = true;
    if (locationEditor) {
      locationEditor.hidden = false;
      locationEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (editLocationBtn) {
  editLocationBtn.addEventListener('click', () => {
    if (!selectedLocationKey || !locationProfiles[selectedLocationKey]) {
      safeAlert('Select a location first.');
      return;
    }
    creatingLocation = false;
    renderLocationEditorFields(locationProfiles[selectedLocationKey]);
    if (saveLocationBtn) saveLocationBtn.disabled = false;
    if (locationEditor) {
      locationEditor.hidden = false;
      locationEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (saveLocationBtn) {
  saveLocationBtn.addEventListener('click', () => {
    const base = creatingLocation ? createDefaultLocation('Location') : locationProfiles[selectedLocationKey];
    if (!base) return;
    const updated = readLocationEditorValues(base);
    const name = (updated.name || '').trim();
    if (!name) {
      safeAlert('Location name is required.');
      return;
    }

    if (creatingLocation) {
      const baseKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `location-${Date.now()}`;
      let key = baseKey;
      let suffix = 2;
      while (locationProfiles[key]) {
        key = `${baseKey}-${suffix}`;
        suffix += 1;
      }
      locationProfiles[key] = { ...updated, sublocations: updated.sublocations || [] };
      selectedLocationKey = key;
      creatingLocation = false;
    } else {
      locationProfiles[selectedLocationKey] = {
        ...updated,
        sublocations: locationProfiles[selectedLocationKey].sublocations || []
      };
    }

    if (locationEditor) locationEditor.hidden = true;
    if (saveLocationBtn) saveLocationBtn.disabled = true;
    renderLocationsTable(locationsSearch?.value || '');
  });
}

if (deleteLocationBtn) {
  deleteLocationBtn.addEventListener('click', () => {
    if (!selectedLocationKey || !locationProfiles[selectedLocationKey]) {
      safeAlert('Select a location first.');
      return;
    }
    if (!safeConfirm(`Delete location "${locationProfiles[selectedLocationKey].name}"?`)) return;
    Object.values(locationProfiles).forEach((profile) => {
      if (!profile.sublocations) return;
      profile.sublocations = profile.sublocations.filter((key) => key !== selectedLocationKey);
    });
    delete locationProfiles[selectedLocationKey];
    selectedLocationKey = null;
    creatingLocation = false;
    if (locationEditor) locationEditor.hidden = true;
    if (locationProfile) locationProfile.hidden = true;
    if (saveLocationBtn) saveLocationBtn.disabled = true;
    renderLocationsTable(locationsSearch?.value || '');
  });
}

if (linkSublocationBtn) {
  linkSublocationBtn.addEventListener('click', () => {
    if (!selectedLocationKey || !locationProfiles[selectedLocationKey]) return;
    const profile = locationProfiles[selectedLocationKey];
    const available = Object.entries(locationProfiles).filter(([key]) => {
      if (key === selectedLocationKey) return false;
      return !(profile.sublocations || []).includes(key);
    });
    if (!available.length) {
      safeAlert('No available locations to link as sublocations.');
      return;
    }
    sublocationLinkSelect.innerHTML = available
      .map(([key, location]) => `<option value="${key}">${escapeHtml(location.name)}</option>`)
      .join('');
    sublocationLinkPicker.hidden = false;
  });
}

if (sublocationLinkConfirmBtn) {
  sublocationLinkConfirmBtn.addEventListener('click', () => {
    if (!selectedLocationKey || !locationProfiles[selectedLocationKey]) return;
    const selectedKey = sublocationLinkSelect.value;
    if (!selectedKey) return;
    const profile = locationProfiles[selectedLocationKey];
    if (!profile.sublocations) profile.sublocations = [];
    if (!profile.sublocations.includes(selectedKey)) profile.sublocations.push(selectedKey);
    sublocationLinkPicker.hidden = true;
    renderLocationProfile(profile);
  });
}

if (sublocationLinkCancelBtn) {
  sublocationLinkCancelBtn.addEventListener('click', () => {
    if (sublocationLinkPicker) sublocationLinkPicker.hidden = true;
  });
}

if (locationSublocationList) {
  locationSublocationList.addEventListener('click', (event) => {
    const unlinkButton = event.target.closest('[data-unlink-sublocation-key]');
    if (unlinkButton) {
      if (!selectedLocationKey || !locationProfiles[selectedLocationKey]) return;
      const unlinkKey = unlinkButton.dataset.unlinkSublocationKey;
      if (!unlinkKey) return;
      const profile = locationProfiles[selectedLocationKey];
      profile.sublocations = (profile.sublocations || []).filter((key) => key !== unlinkKey);
      renderLocationProfile(profile);
      return;
    }

    const card = event.target.closest('[data-sublocation-key]');
    if (!card) return;
    openProfileFromLink('notifications', card.dataset.sublocationKey);
  });
}

if (linkLocationProfileBtn) {
  linkLocationProfileBtn.addEventListener('click', () => {
    if (!selectedLocationKey || !locationProfiles[selectedLocationKey]) {
      safeAlert('Select a location first.');
      return;
    }
    const profile = locationProfiles[selectedLocationKey];
    if (addProfileLinkToRecord(profile, 'Headmate')) {
      renderLocationsTable(locationsSearch?.value || '');
      renderLocationProfile(profile);
    }
  });
}

if (refreshLocationMapBtn) {
  refreshLocationMapBtn.addEventListener('click', () => renderLocationMap(selectedLocationKey));
}

if (locationMapCanvas) {
  locationMapCanvas.addEventListener('click', (event) => {
    const node = event.target.closest('[data-map-location-key]');
    if (!node) return;
    openProfileFromLink('notifications', node.dataset.mapLocationKey);
  });
}

renderLocationsTable();

// =====================
// Subsystems: Per-user subsystem management
// =====================
const subsystemsByUser = {};
let selectedSubsystemKey = null;
let creatingSubsystem = false;

const subsystemsGrid = document.getElementById('subsystemsGrid');
const subsystemProfile = document.getElementById('subsystemProfile');
const subsystemBanner = document.getElementById('subsystemBanner');
const subsystemPhoto = document.getElementById('subsystemPhoto');
const subsystemName = document.getElementById('subsystemName');
const subsystemMeta = document.getElementById('subsystemMeta');
const subsystemProfileGrid = document.getElementById('subsystemProfileGrid');
const addSubsystemBtn = document.getElementById('addSubsystemBtn');
const addSubsystemFromTemplateBtn = document.getElementById('addSubsystemFromTemplateBtn');
const editSubsystemBtn = document.getElementById('editSubsystemBtn');
const linkSubsystemProfileBtn = document.getElementById('linkSubsystemProfileBtn');
const saveSubsystemBtn = document.getElementById('saveSubsystemBtn');
const deleteSubsystemBtn = document.getElementById('deleteSubsystemBtn');
const subsystemEditor = document.getElementById('subsystemEditor');
const subsystemEditorFields = document.getElementById('subsystemEditorFields');
const subsystemHub = document.getElementById('subsystemHub');
const subsystemHubList = document.getElementById('subsystemHubList');
const linkHeadmateBtn = document.getElementById('linkHeadmateBtn');
const subsystemLinkPicker = document.getElementById('subsystemLinkPicker');
const subsystemLinkSelect = document.getElementById('subsystemLinkSelect');
const subsystemLinkConfirmBtn = document.getElementById('subsystemLinkConfirmBtn');
const subsystemLinkCancelBtn = document.getElementById('subsystemLinkCancelBtn');

const subsystemFieldSchema = [
  { key: 'name', label: 'Name' },
  { key: 'profilePhoto', label: 'Profile photo' },
  { key: 'banner', label: 'Banner' },
  { key: 'color', label: 'Color' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'tags', label: 'Tags' },
  { key: 'customFields', label: 'Custom fields', type: 'textarea' },
  { key: 'linkedProfiles', label: 'Linked profiles' }
];

function ensureSubsystemStore(userName) {
  if (!subsystemsByUser[userName]) subsystemsByUser[userName] = {};
  return subsystemsByUser[userName];
}

function getActiveSubsystems() {
  return ensureSubsystemStore(getActiveUserName());
}

function createDefaultSubsystem(name) {
  const initial = name[0]?.toUpperCase() || 'S';
  const colors = ['#6c63ff', '#ff6584', '#43d9ad', '#f5a623', '#a29bfe', '#fd79a8', '#0984e3', '#e17055'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return {
    name,
    profilePhoto: initial,
    banner: `${name} Banner`,
    color,
    description: 'No description set.',
    tags: 'Not set',
    customFields: 'Not set',
    linkedProfiles: 'Not set',
    linkedHeadmates: []
  };
}

function renderSubsystemEditorFields(subsystem) {
  if (!subsystemEditorFields) return;
  const fp = subsystem.fieldPrivacy || {};
  subsystemEditorFields.innerHTML = subsystemFieldSchema.map((field) => {
    const id = `subsystemEdit_${field.key}`;
    const safeValue = String(subsystem[field.key] ?? '');
    const privSel = renderPrivacySelect(`priv_subsystemEdit_${field.key}`, fp[field.key] || 'public');
    const inputHtml = renderFieldInput(field, id, safeValue);
    return `<div class="editor-field-row">${inputHtml}${privSel}</div>`;
  }).join('');

  bindColorPickers(subsystemEditorFields);
  bindAutoGrowingTextareas(subsystemEditorFields);
}

function readSubsystemEditorValues(base) {
  const updated = { ...base };
  subsystemFieldSchema.forEach((field) => {
    const el = document.getElementById(`subsystemEdit_${field.key}`);
    if (!el) return;
    updated[field.key] = getEditorInputValue(el) || (base[field.key] ?? '');
  });
  updated.fieldPrivacy = readFieldPrivacy(subsystemFieldSchema, 'subsystemEdit', base);
  return updated;
}

function renderSubsystemHubList(subsystem) {
  if (!subsystemHubList) return;
  const activeProfiles = getActiveHeadmateProfiles();
  const linked = subsystem.linkedHeadmates || [];
  if (!linked.length) {
    subsystemHubList.innerHTML = `<p class="headmate-hint" style="margin:8px 0">No ${escapeHtml(getTermLabel('headmates').toLowerCase())} linked yet. Use + Link ${escapeHtml(getSingularTerm('headmates'))} to add some.</p>`;
    return;
  }
  subsystemHubList.innerHTML = linked.map((key) => {
    const h = activeProfiles[key];
    if (!h) return '';
    return `
      <div class="subsystem-hub-member" data-hub-key="${key}">
        ${renderAvatarMarkup(h.profilePhoto || h.name?.[0]?.toUpperCase() || 'H', h.name?.[0]?.toUpperCase() || 'H', h.color || '#6c63ff', 'sm')}
        <div class="subsystem-hub-member-info">
          <strong>${escapeHtml(h.name)}</strong>
          <span>${escapeHtml(h.mainRole || 'No role')}</span>
        </div>
        <button class="btn-sm subsystem-unlink-btn" type="button" data-unlink-key="${key}" title="Unlink">&#10005;</button>
      </div>
    `;
  }).filter(Boolean).join('');
}

function renderSubsystemProfile(key) {
  const subsystems = getActiveSubsystems();
  const subsystem = subsystems[key];
  if (!subsystem || !subsystemProfile) return;

  const photo = subsystem.profilePhoto || 'S';
  applyPhotoStyle(subsystemPhoto, photo, subsystem.name?.[0] || 'S', subsystem.color || '#6c63ff');
  applyBannerStyle(subsystemBanner, subsystem.banner, subsystem.color || '#6c63ff', '--headmate-color');
  subsystemName.textContent = subsystem.name;
  const count = (subsystem.linkedHeadmates || []).length;
  subsystemMeta.textContent = `${count} ${getTermCountLabel('headmates', count).toLowerCase()} linked`;

  const fpS = subsystem.fieldPrivacy || {};
  const viewerLevelS = getViewerTrustLevel();
  const baseSubsystemFields = subsystemFieldSchema
    .filter((field) => field.key !== 'customFields' && canViewField(fpS[field.key] || 'public', viewerLevelS))
    .map((field) => {
      const value = renderProfileFieldValue('subsystem', field, subsystem);
      const badge = privacyBadge(fpS[field.key]);
      return `<article class="headmate-field"><span class="headmate-field-label">${escapeHtml(field.label)}${badge}</span><div class="headmate-field-value">${value}</div></article>`;
    });
  const subsystemCustomFields = canViewField(fpS.customFields || 'public', viewerLevelS)
    ? renderCustomFieldArticles(subsystem, fpS.customFields || 'public')
    : [];
  subsystemProfileGrid.innerHTML = baseSubsystemFields.concat(subsystemCustomFields).join('');

  subsystemProfile.hidden = false;
  renderSubsystemHubList(subsystem);
}

function renderSubsystemsGrid() {
  if (!subsystemsGrid) return;
  const subsystems = getActiveSubsystems();
  const entries = Object.entries(subsystems);
  if (!entries.length) {
    subsystemsGrid.innerHTML = '<p class="headmate-hint">No subsystems yet. Use + Add Subsystem to create one.</p>';
    return;
  }
  subsystemsGrid.innerHTML = entries.map(([key, sub]) => {
    const photo = sub.profilePhoto || 'S';
    const hasPhotoUrl = isMediaUrl(photo);
    const banner = sub.banner || '';
    const hasBannerUrl = isMediaUrl(banner);
    const photoStyle = hasPhotoUrl
      ? `style="background-image:url('${escapeCssUrl(photo)}'); color:transparent; background-color:${sub.color}; background-size:cover; background-position:center; background-repeat:no-repeat;"`
      : `style="background-color:${sub.color};"`;
    const bannerStyle = hasBannerUrl
      ? `style="--profile-color:${sub.color}; background-image:linear-gradient(120deg, rgba(0,0,0,0.38), rgba(0,0,0,0.12)), url('${escapeCssUrl(banner)}'); background-size:cover; background-position:center; background-repeat:no-repeat;"`
      : `style="--profile-color:${sub.color}"`;
    const count = (sub.linkedHeadmates || []).length;
    const isSelected = selectedSubsystemKey === key;
    return `
      <article class="system-profile-card subsystem-card ${isSelected ? 'selected' : ''}" data-subsystem-key="${key}">
        <div class="system-profile-banner" ${bannerStyle}></div>
        <div class="system-profile-content">
          <div class="system-profile-photo" ${photoStyle}>${hasPhotoUrl ? '' : escapeHtml(photo)}</div>
          <div class="system-profile-title">
            <h4>${escapeHtml(sub.name)}</h4>
            <div class="system-profile-description">${renderMarkdown(sub.description || '')}</div>
          </div>
          <div class="system-profile-field"><strong>Tags</strong><span>${escapeHtml(sub.tags || 'Not set')}</span></div>
          <div class="system-profile-field"><strong>${escapeHtml(getTermLabel('headmates'))}</strong><span>${count} linked</span></div>
        </div>
      </article>
    `;
  }).join('');
}

if (subsystemsGrid) {
  subsystemsGrid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-subsystem-key]');
    if (!card) return;
    const key = card.dataset.subsystemKey;
    const subsystems = getActiveSubsystems();
    if (!subsystems[key]) return;
    selectedSubsystemKey = key;
    creatingSubsystem = false;
    if (saveSubsystemBtn) saveSubsystemBtn.disabled = true;
    if (subsystemEditor) subsystemEditor.hidden = true;
    if (subsystemLinkPicker) subsystemLinkPicker.hidden = true;
    renderSubsystemsGrid();
    renderSubsystemProfile(key);
    subsystemProfile.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (addSubsystemBtn) {
  addSubsystemBtn.addEventListener('click', () => {
    creatingSubsystem = true;
    selectedSubsystemKey = null;
    const defaultName = `Subsystem ${Object.keys(getActiveSubsystems()).length + 1}`;
    const seed = createDefaultSubsystem(defaultName);
    renderSubsystemEditorFields(seed);
    subsystemPhoto.textContent = seed.profilePhoto;
    subsystemPhoto.style.backgroundImage = '';
    subsystemPhoto.style.color = '';
    subsystemBanner.style.setProperty('--headmate-color', seed.color);
    subsystemName.textContent = seed.name;
    subsystemMeta.textContent = '0 headmates linked';
    subsystemProfileGrid.innerHTML = '';
    if (subsystemHubList) subsystemHubList.innerHTML = '';
    if (subsystemLinkPicker) subsystemLinkPicker.hidden = true;
    if (saveSubsystemBtn) saveSubsystemBtn.disabled = false;
    if (subsystemEditor) subsystemEditor.hidden = false;
    subsystemProfile.hidden = false;
    subsystemProfile.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (addSubsystemFromTemplateBtn) {
  addSubsystemFromTemplateBtn.addEventListener('click', () => {
    const template = pickTemplateForTarget('subsystem');
    if (!template) return;
    creatingSubsystem = true;
    selectedSubsystemKey = null;
    const baseName = (template.name || '').trim() || `Subsystem ${Object.keys(getActiveSubsystems()).length + 1}`;
    const seed = {
      ...createDefaultSubsystem(baseName),
      name: baseName,
      description: template.description || 'No description set.',
      tags: template.category || 'Not set',
      customFields: template.defaultContent || 'Not set',
      banner: template.banner || `${baseName} Banner`,
      color: template.color || '#6c63ff',
      profilePhoto: baseName[0]?.toUpperCase() || 'S'
    };
    renderSubsystemEditorFields(seed);
    subsystemPhoto.textContent = seed.profilePhoto;
    subsystemPhoto.style.backgroundImage = '';
    subsystemPhoto.style.color = '';
    subsystemBanner.style.setProperty('--headmate-color', seed.color);
    subsystemName.textContent = seed.name;
    subsystemMeta.textContent = '0 headmates linked';
    subsystemProfileGrid.innerHTML = '';
    if (subsystemHubList) subsystemHubList.innerHTML = '';
    if (subsystemLinkPicker) subsystemLinkPicker.hidden = true;
    if (saveSubsystemBtn) saveSubsystemBtn.disabled = false;
    if (subsystemEditor) subsystemEditor.hidden = false;
    subsystemProfile.hidden = false;
    subsystemProfile.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (editSubsystemBtn) {
  editSubsystemBtn.addEventListener('click', () => {
    if (!selectedSubsystemKey) { safeAlert('Select a subsystem first.'); return; }
    const subsystems = getActiveSubsystems();
    if (!subsystems[selectedSubsystemKey]) return;
    creatingSubsystem = false;
    renderSubsystemEditorFields(subsystems[selectedSubsystemKey]);
    if (saveSubsystemBtn) saveSubsystemBtn.disabled = false;
    if (subsystemEditor) {
      subsystemEditor.hidden = false;
      subsystemEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (saveSubsystemBtn) {
  saveSubsystemBtn.addEventListener('click', () => {
    const subsystems = getActiveSubsystems();
    const base = creatingSubsystem
      ? createDefaultSubsystem('New Subsystem')
      : subsystems[selectedSubsystemKey];
    if (!base) return;
    const updated = readSubsystemEditorValues(base);
    const name = (updated.name || '').trim();
    if (!name) { safeAlert('Name is required.'); return; }

    if (creatingSubsystem) {
      const baseKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `sub-${Date.now()}`;
      let key = baseKey;
      let suffix = 2;
      while (subsystems[key]) { key = `${baseKey}-${suffix}`; suffix++; }
      subsystems[key] = { ...updated, linkedHeadmates: [] };
      selectedSubsystemKey = key;
      creatingSubsystem = false;
    } else {
      const existing = subsystems[selectedSubsystemKey];
      subsystems[selectedSubsystemKey] = { ...updated, linkedHeadmates: existing.linkedHeadmates || [] };
    }

    if (subsystemEditor) subsystemEditor.hidden = true;
    if (saveSubsystemBtn) saveSubsystemBtn.disabled = true;
    renderSubsystemsGrid();
    renderSubsystemProfile(selectedSubsystemKey);
  });
}

if (deleteSubsystemBtn) {
  deleteSubsystemBtn.addEventListener('click', () => {
    if (!selectedSubsystemKey) { safeAlert('Select a subsystem first.'); return; }
    const subsystems = getActiveSubsystems();
    if (!subsystems[selectedSubsystemKey]) return;
    if (!safeConfirm(`Delete subsystem "${subsystems[selectedSubsystemKey].name}"?`)) return;
    delete subsystems[selectedSubsystemKey];
    selectedSubsystemKey = null;
    if (subsystemProfile) subsystemProfile.hidden = true;
    if (subsystemEditor) subsystemEditor.hidden = true;
    if (saveSubsystemBtn) saveSubsystemBtn.disabled = true;
    renderSubsystemsGrid();
  });
}

if (linkHeadmateBtn) {
  linkHeadmateBtn.addEventListener('click', () => {
    if (!selectedSubsystemKey) return;
    const subsystems = getActiveSubsystems();
    const sub = subsystems[selectedSubsystemKey];
    if (!sub) return;
    const activeProfiles = getActiveHeadmateProfiles();
    const available = Object.entries(activeProfiles).filter(
      ([key]) => !(sub.linkedHeadmates || []).includes(key)
    );
    if (!available.length) {
      safeAlert('All headmates are already linked, or there are no headmates for this user.');
      return;
    }
    subsystemLinkSelect.innerHTML = available
      .map(([key, h]) => `<option value="${key}">${escapeHtml(h.name)}</option>`)
      .join('');
    subsystemLinkPicker.hidden = false;
  });
}

if (subsystemLinkConfirmBtn) {
  subsystemLinkConfirmBtn.addEventListener('click', () => {
    if (!selectedSubsystemKey) return;
    const subsystems = getActiveSubsystems();
    const sub = subsystems[selectedSubsystemKey];
    if (!sub) return;
    const key = subsystemLinkSelect.value;
    if (!key) return;
    if (!sub.linkedHeadmates) sub.linkedHeadmates = [];
    if (!sub.linkedHeadmates.includes(key)) sub.linkedHeadmates.push(key);
    subsystemLinkPicker.hidden = true;
    const count = sub.linkedHeadmates.length;
    subsystemMeta.textContent = `${count} headmate${count !== 1 ? 's' : ''} linked`;
    renderSubsystemHubList(sub);
    renderSubsystemsGrid();
  });
}

if (subsystemLinkCancelBtn) {
  subsystemLinkCancelBtn.addEventListener('click', () => {
    if (subsystemLinkPicker) subsystemLinkPicker.hidden = true;
  });
}

if (linkSubsystemProfileBtn) {
  linkSubsystemProfileBtn.addEventListener('click', () => {
    const subsystems = getActiveSubsystems();
    if (!selectedSubsystemKey || !subsystems[selectedSubsystemKey]) {
      safeAlert('Select a subsystem first.');
      return;
    }
    const subsystem = subsystems[selectedSubsystemKey];
    if (addProfileLinkToRecord(subsystem, 'Headmate')) {
      renderSubsystemsGrid();
      renderSubsystemProfile(selectedSubsystemKey);
    }
  });
}

if (subsystemHubList) {
  subsystemHubList.addEventListener('click', (e) => {
    const btn = e.target.closest('.subsystem-unlink-btn');
    if (btn) {
      const key = btn.dataset.unlinkKey;
      if (!key || !selectedSubsystemKey) return;
      const subsystems = getActiveSubsystems();
      const sub = subsystems[selectedSubsystemKey];
      if (!sub) return;
      if (!safeConfirm('Unlink this headmate from the subsystem?')) return;
      sub.linkedHeadmates = (sub.linkedHeadmates || []).filter((k) => k !== key);
      const count = sub.linkedHeadmates.length;
      subsystemMeta.textContent = `${count} headmate${count !== 1 ? 's' : ''} linked`;
      renderSubsystemHubList(sub);
      renderSubsystemsGrid();
      return;
    }

    const member = e.target.closest('[data-hub-key]');
    if (!member) return;
    openProfileFromLink('parts', member.dataset.hubKey);
  });
}

renderSubsystemsGrid();

// =====================
// Items: Profile Manager
// =====================
const itemProfiles = {};
let selectedItemKey = null;
let creatingItem = false;

const itemsTableBody = document.getElementById('itemsTableBody');
const itemsSearch = document.getElementById('itemsSearch');
const itemProfile = document.getElementById('itemProfile');
const itemBanner = document.getElementById('itemBanner');
const itemPhoto = document.getElementById('itemPhoto');
const itemName = document.getElementById('itemName');
const itemMeta = document.getElementById('itemMeta');
const itemProfileGrid = document.getElementById('itemProfileGrid');
const addItemBtn = document.getElementById('addItemBtn');
const addItemFromTemplateBtn = document.getElementById('addItemFromTemplateBtn');
const editItemBtn = document.getElementById('editItemBtn');
const linkItemProfileBtn = document.getElementById('linkItemProfileBtn');
const saveItemBtn = document.getElementById('saveItemBtn');
const deleteItemBtn = document.getElementById('deleteItemBtn');
const itemEditor = document.getElementById('itemEditor');
const itemEditorFields = document.getElementById('itemEditorFields');

const itemFieldSchema = [
  { key: 'name', label: 'Name' },
  { key: 'tag', label: 'Primary tag' },
  { key: 'tags', label: 'Tags' },
  { key: 'customFields', label: 'Custom fields', type: 'textarea' },
  { key: 'associatedAlters', label: 'Associated alters (comma separated)' },
  { key: 'linkedProfiles', label: 'Linked profiles' },
  { key: 'profilePhoto', label: 'Profile photo' },
  { key: 'banner', label: 'Banner' },
  { key: 'color', label: 'Color' }
];

function createDefaultItem(name) {
  const initial = name[0]?.toUpperCase() || 'I';
  const colors = ['#6c63ff', '#ff6584', '#43d9ad', '#f5a623', '#a29bfe', '#fd79a8', '#0984e3', '#e17055'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return {
    name,
    tag: 'Not set',
    tags: 'Not set',
    customFields: 'Not set',
    associatedAlters: 'Not set',
    linkedProfiles: 'Not set',
    profilePhoto: initial,
    banner: `${name} Banner`,
    color
  };
}

function renderItemEditorFields(profile) {
  if (!itemEditorFields) return;
  const fp = profile.fieldPrivacy || {};
  itemEditorFields.innerHTML = itemFieldSchema.map((field) => {
    const id = `itemEdit_${field.key}`;
    const safeValue = String(profile[field.key] ?? '');
    const privSel = renderPrivacySelect(`priv_itemEdit_${field.key}`, fp[field.key] || 'public');
    return `<div class="editor-field-row">${renderFieldInput(field, id, safeValue)}${privSel}</div>`;
  }).join('');

  bindColorPickers(itemEditorFields);
  bindAutoGrowingTextareas(itemEditorFields);
}

function readItemEditorValues(base) {
  const updated = { ...base };
  itemFieldSchema.forEach((field) => {
    const el = document.getElementById(`itemEdit_${field.key}`);
    if (!el) return;
    updated[field.key] = getEditorInputValue(el) || (base[field.key] ?? 'Not set');
  });
  updated.fieldPrivacy = readFieldPrivacy(itemFieldSchema, 'itemEdit', base);
  return updated;
}

function renderItemProfile(profile) {
  if (!itemProfile || !itemProfileGrid) return;
  const photo = profile.profilePhoto || 'I';
  applyPhotoStyle(itemPhoto, photo, profile.name?.[0] || 'I', profile.color || '#6c63ff');
  applyBannerStyle(itemBanner, profile.banner, profile.color || '#6c63ff', '--headmate-color');
  itemName.textContent = profile.name;
  itemMeta.textContent = `${profile.tag || 'No tag'} • ${profile.associatedAlters || 'No alters'}`;

  const fpI = profile.fieldPrivacy || {};
  const viewerLevelI = getViewerTrustLevel();
  const baseItemFields = itemFieldSchema
    .filter((field) => field.key !== 'customFields' && canViewField(fpI[field.key] || 'public', viewerLevelI))
    .map((field) => {
      const value = renderProfileFieldValue('item', field, profile);
      const badge = privacyBadge(fpI[field.key]);
      return `<article class="headmate-field"><span class="headmate-field-label">${escapeHtml(field.label)}${badge}</span><div class="headmate-field-value">${value}</div></article>`;
    });
  const itemCustomFields = canViewField(fpI.customFields || 'public', viewerLevelI)
    ? renderCustomFieldArticles(profile, fpI.customFields || 'public')
    : [];
  itemProfileGrid.innerHTML = baseItemFields.concat(itemCustomFields).join('');

  itemProfile.hidden = false;
}

function renderItemsTable(filter) {
  if (!itemsTableBody) return;
  const entries = Object.entries(itemProfiles);
  const q = (filter || '').toLowerCase().trim();
  const filtered = q ? entries.filter(([, p]) => p.name.toLowerCase().includes(q) || (p.tag || '').toLowerCase().includes(q) || (p.tags || '').toLowerCase().includes(q)) : entries;

  itemsTableBody.innerHTML = filtered.length
    ? filtered.map(([key, p], i) => `
        <tr data-item="${key}" class="${selectedItemKey === key ? 'selected' : ''}">
          <td>#${String(i + 1).padStart(3, '0')}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.tag || 'Not set')}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3">No items yet.</td></tr>';

  if (selectedItemKey && itemProfiles[selectedItemKey]) {
    renderItemProfile(itemProfiles[selectedItemKey]);
  } else {
    if (itemProfile) itemProfile.hidden = true;
    if (itemEditor) itemEditor.hidden = true;
    if (saveItemBtn) saveItemBtn.disabled = true;
  }
}

if (itemsTableBody) {
  itemsTableBody.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-item]');
    if (!row) return;
    const key = row.dataset.item;
    const profile = itemProfiles[key];
    if (!profile) return;
    document.querySelectorAll('#itemsTableBody tr[data-item]').forEach((r) => r.classList.remove('selected'));
    row.classList.add('selected');
    selectedItemKey = key;
    creatingItem = false;
    if (saveItemBtn) saveItemBtn.disabled = true;
    if (itemEditor) itemEditor.hidden = true;
    renderItemProfile(profile);
    itemProfile.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (itemsSearch) {
  itemsSearch.addEventListener('input', () => renderItemsTable(itemsSearch.value));
}

if (linkItemProfileBtn) {
  linkItemProfileBtn.addEventListener('click', () => {
    if (!selectedItemKey || !itemProfiles[selectedItemKey]) {
      safeAlert('Select an item first.');
      return;
    }
    const profile = itemProfiles[selectedItemKey];
    if (addProfileLinkToRecord(profile, 'Headmate')) {
      renderItemsTable(itemsSearch?.value || '');
      renderItemProfile(profile);
    }
  });
}

if (addItemBtn) {
  addItemBtn.addEventListener('click', () => {
    creatingItem = true;
    selectedItemKey = null;
    const defaultName = `Item ${Object.keys(itemProfiles).length + 1}`;
    const seed = createDefaultItem(defaultName);
    renderItemProfile(seed);
    renderItemEditorFields(seed);
    if (saveItemBtn) saveItemBtn.disabled = false;
    if (itemEditor) {
      itemEditor.hidden = false;
      itemEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (addItemFromTemplateBtn) {
  addItemFromTemplateBtn.addEventListener('click', () => {
    const template = pickTemplateForTarget('item');
    if (!template) return;
    creatingItem = true;
    selectedItemKey = null;
    const baseName = (template.name || '').trim() || `Item ${Object.keys(itemProfiles).length + 1}`;
    const seed = {
      ...createDefaultItem(baseName),
      name: baseName,
      tag: template.category || 'Custom',
      tags: template.category || 'Not set',
      customFields: template.defaultContent || 'Not set',
      associatedAlters: template.defaultContent || 'Not set',
      banner: template.banner || `${baseName} Banner`,
      color: template.color || '#6c63ff',
      profilePhoto: baseName[0]?.toUpperCase() || 'I'
    };
    renderItemProfile(seed);
    renderItemEditorFields(seed);
    if (saveItemBtn) saveItemBtn.disabled = false;
    if (itemEditor) {
      itemEditor.hidden = false;
      itemEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (editItemBtn) {
  editItemBtn.addEventListener('click', () => {
    if (!selectedItemKey || !itemProfiles[selectedItemKey]) { safeAlert('Select an item first.'); return; }
    creatingItem = false;
    renderItemEditorFields(itemProfiles[selectedItemKey]);
    if (saveItemBtn) saveItemBtn.disabled = false;
    if (itemEditor) {
      itemEditor.hidden = false;
      itemEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (saveItemBtn) {
  saveItemBtn.addEventListener('click', () => {
    const base = creatingItem ? createDefaultItem('Item') : itemProfiles[selectedItemKey];
    if (!base) return;
    const updated = readItemEditorValues(base);
    const name = (updated.name || '').trim();
    if (!name) { safeAlert('Name is required.'); return; }

    if (creatingItem) {
      const baseKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `item-${Date.now()}`;
      let key = baseKey;
      let suffix = 2;
      while (itemProfiles[key]) { key = `${baseKey}-${suffix}`; suffix++; }
      itemProfiles[key] = updated;
      selectedItemKey = key;
      creatingItem = false;
    } else {
      itemProfiles[selectedItemKey] = updated;
    }

    if (itemEditor) itemEditor.hidden = true;
    if (saveItemBtn) saveItemBtn.disabled = true;
    renderItemsTable(itemsSearch?.value);
  });
}

if (deleteItemBtn) {
  deleteItemBtn.addEventListener('click', () => {
    if (!selectedItemKey || !itemProfiles[selectedItemKey]) { safeAlert('Select an item first.'); return; }
    if (!safeConfirm(`Delete item "${itemProfiles[selectedItemKey].name}"?`)) return;
    delete itemProfiles[selectedItemKey];
    selectedItemKey = null;
    if (itemProfile) itemProfile.hidden = true;
    if (itemEditor) itemEditor.hidden = true;
    if (saveItemBtn) saveItemBtn.disabled = true;
    renderItemsTable(itemsSearch?.value);
  });
}

renderItemsTable();

// Init chat sidebar on page load
renderChatSidebar();

// =====================
// Health: Medication Tracker
// =====================
const medNameInput = document.getElementById('medNameInput');
const medDosageInput = document.getElementById('medDosageInput');
const medScheduleInput = document.getElementById('medScheduleInput');
const addMedicationBtn = document.getElementById('addMedicationBtn');
const medicationsTableBody = document.getElementById('medicationsTableBody');
const medicationCheckinList = document.getElementById('medicationCheckinList');
const clearMedicationLogBtn = document.getElementById('clearMedicationLogBtn');

const medicationsByUser = {};
const medicationCheckinsByUser = {};

function ensureMedicationStore(userName) {
  if (!medicationsByUser[userName]) medicationsByUser[userName] = [];
  return medicationsByUser[userName];
}

function ensureMedicationCheckinStore(userName) {
  if (!medicationCheckinsByUser[userName]) medicationCheckinsByUser[userName] = [];
  return medicationCheckinsByUser[userName];
}

function formatTakenAt(ts) {
  if (!ts) return 'Not taken yet';
  const date = new Date(ts);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderMedicationCheckinLog() {
  if (!medicationCheckinList) return;
  const checkins = ensureMedicationCheckinStore(getActiveUserName());

  if (!checkins.length) {
    medicationCheckinList.innerHTML = '<li class="med-checkin-empty">No check-ins yet.</li>';
    return;
  }

  medicationCheckinList.innerHTML = [...checkins].reverse().map((entry) => `
    <li class="med-checkin-item">
      <div class="med-checkin-title">${escapeHtml(entry.medName)} <span>${escapeHtml(entry.dosage)}</span></div>
      <div class="med-checkin-meta">${escapeHtml(entry.schedule)} • ${escapeHtml(formatTakenAt(entry.takenAt))}</div>
    </li>
  `).join('');
}

function renderMedicationTracker() {
  if (!medicationsTableBody) return;
  const meds = ensureMedicationStore(getActiveUserName());

  if (!meds.length) {
    medicationsTableBody.innerHTML = '<tr><td colspan="5">No medications added for this user yet.</td></tr>';
    return;
  }

  medicationsTableBody.innerHTML = meds.map((med) => `
    <tr data-med-id="${med.id}">
      <td>${escapeHtml(med.name)}</td>
      <td>${escapeHtml(med.dosage)}</td>
      <td>${escapeHtml(med.schedule)}</td>
      <td>${escapeHtml(formatTakenAt(med.lastTakenAt))}</td>
      <td>
        <button class="btn-sm" type="button" data-med-action="taken" data-med-id="${med.id}">Mark Taken</button>
        <button class="btn-sm" type="button" data-med-action="delete" data-med-id="${med.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  renderMedicationCheckinLog();
}

if (addMedicationBtn) {
  addMedicationBtn.addEventListener('click', () => {
    const name = (medNameInput?.value || '').trim();
    const dosage = (medDosageInput?.value || '').trim();
    const schedule = (medScheduleInput?.value || '').trim();

    if (!name || !dosage || !schedule) {
      safeAlert('Please fill in medication name, dosage, and schedule.');
      return;
    }

    const meds = ensureMedicationStore(getActiveUserName());
    meds.push({
      id: `med-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name,
      dosage,
      schedule,
      lastTakenAt: null
    });

    medNameInput.value = '';
    medDosageInput.value = '';
    medScheduleInput.value = '';
    renderMedicationTracker();
  });
}

if (medicationsTableBody) {
  medicationsTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-med-action]');
    if (!button) return;

    const action = button.dataset.medAction;
    const medId = button.dataset.medId;
    if (!medId) return;

    const meds = ensureMedicationStore(getActiveUserName());
    const index = meds.findIndex((med) => med.id === medId);
    if (index < 0) return;

    if (action === 'taken') {
      const takenAt = Date.now();
      meds[index].lastTakenAt = takenAt;
      const checkins = ensureMedicationCheckinStore(getActiveUserName());
      checkins.push({
        id: `checkin-${takenAt}-${Math.floor(Math.random() * 10000)}`,
        medId,
        medName: meds[index].name,
        dosage: meds[index].dosage,
        schedule: meds[index].schedule,
        takenAt
      });
      renderMedicationTracker();
      return;
    }

    if (action === 'delete') {
      if (!safeConfirm(`Delete medication "${meds[index].name}"?`)) return;
      meds.splice(index, 1);
      renderMedicationTracker();
    }
  });
}

if (clearMedicationLogBtn) {
  clearMedicationLogBtn.addEventListener('click', () => {
    const checkins = ensureMedicationCheckinStore(getActiveUserName());
    if (!checkins.length) return;
    if (!safeConfirm('Clear medication check-in log for this user?')) return;
    checkins.length = 0;
    renderMedicationCheckinLog();
  });
}

renderMedicationTracker();

// =====================
// Templates: Custom Template Manager
// =====================
const templatesSearch = document.getElementById('templatesSearch');
const templatesTableBody = document.getElementById('templatesTableBody');
const addTemplateBtn = document.getElementById('addTemplateBtn');
const templateProfile = document.getElementById('templateProfile');
const templateBanner = document.getElementById('templateBanner');
const templatePhoto = document.getElementById('templatePhoto');
const templateName = document.getElementById('templateName');
const templateMeta = document.getElementById('templateMeta');
const templateProfileGrid = document.getElementById('templateProfileGrid');
const editTemplateBtn = document.getElementById('editTemplateBtn');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');
const templateEditor = document.getElementById('templateEditor');
const templateEditorFields = document.getElementById('templateEditorFields');
const templateTargetButtons = document.querySelectorAll('[data-template-target-button]');

const TEMPLATE_TARGET_OPTIONS = [
  { value: 'all', label: 'All Profiles' },
  { value: 'headmate', label: 'Headmate' },
  { value: 'system', label: 'System' },
  { value: 'partner', label: 'Partner' },
  { value: 'subsystem', label: 'Subsystem' },
  { value: 'item', label: 'Item' },
  { value: 'location', label: 'Location' }
];

const templateFieldSchema = [
  { key: 'name', label: 'Name' },
  { key: 'target', label: 'Target type' },
  { key: 'category', label: 'Category' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'defaultContent', label: 'Default content', type: 'textarea' },
  { key: 'banner', label: 'Banner' },
  { key: 'color', label: 'Color' }
];

const customTemplates = {};

let selectedTemplateKey = null;
let creatingTemplate = false;

function createDefaultTemplate(name, target = 'all') {
  const colors = ['#6c63ff', '#ff6584', '#43d9ad', '#f5a623', '#a29bfe', '#fd79a8', '#0984e3', '#e17055'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return {
    name,
    target: normalizeTemplateTarget(target),
    category: 'Custom',
    description: 'Not set',
    defaultContent: 'Not set',
    banner: `${name} Banner`,
    color
  };
}

function normalizeTemplateTarget(target) {
  const value = String(target || '').trim().toLowerCase();
  if (!value) return 'all';
  if (value === 'headmates') return 'headmate';
  if (value === 'systems') return 'system';
  if (value === 'items') return 'item';
  if (value === 'locations') return 'location';
  if (value === 'partners') return 'partner';
  if (value === 'subsystems') return 'subsystem';
  if (value === 'general') return 'all';
  return value;
}

function getTemplateTargetLabel(target) {
  const normalized = normalizeTemplateTarget(target);
  return TEMPLATE_TARGET_OPTIONS.find((entry) => entry.value === normalized)?.label || 'All Profiles';
}

function getTemplatesForTarget(target) {
  const wanted = normalizeTemplateTarget(target);
  return Object.entries(customTemplates).filter(([, template]) => {
    const templateTarget = normalizeTemplateTarget(template.target || 'all');
    return templateTarget === 'all' || templateTarget === wanted;
  });
}

function pickTemplateForTarget(target) {
  const matches = getTemplatesForTarget(target);
  if (!matches.length) {
    safeAlert(`No templates found for ${target}. Create one in Forms and set target to ${target} or all.`);
    return null;
  }

  const promptText = matches
    .map(([_, template], index) => `${index + 1}. ${template.name} [${template.category || 'Uncategorized'}]`)
    .join('\n');

  const response = safePrompt(`Choose a template for ${target} by number:\n${promptText}`, '1');
  if (response === null || response === undefined) return null;
  const index = Number(response);
  if (!Number.isInteger(index) || index < 1 || index > matches.length) {
    safeAlert('Invalid template selection.');
    return null;
  }

  return matches[index - 1][1];
}

function renderTemplateEditorFields(profile) {
  if (!templateEditorFields) return;
  templateEditorFields.innerHTML = templateFieldSchema.map((field) => {
    const id = `templateEdit_${field.key}`;
    if (field.key === 'target') {
      const currentTarget = normalizeTemplateTarget(profile[field.key] || 'all');
      return `<label>${field.label}<select class="setting-input" id="${id}">${TEMPLATE_TARGET_OPTIONS.map((option) => `<option value="${option.value}"${option.value === currentTarget ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
    }
    return renderFieldInput(field, id, String(profile[field.key] ?? ''));
  }).join('');

  bindColorPickers(templateEditorFields);
  bindAutoGrowingTextareas(templateEditorFields);
}

function readTemplateEditorValues(baseProfile) {
  const updated = { ...baseProfile };
  templateFieldSchema.forEach((field) => {
    const input = document.getElementById(`templateEdit_${field.key}`);
    if (!input) return;
    const value = getEditorInputValue(input);
    updated[field.key] = value || (baseProfile[field.key] ?? 'Not set');
  });
  updated.target = normalizeTemplateTarget(updated.target || baseProfile.target || 'all');
  return updated;
}

function renderTemplateProfile(profile) {
  if (!templateProfile || !templateProfileGrid) return;

  templatePhoto.textContent = (profile.name?.[0] || 'T').toUpperCase();
  templateName.textContent = profile.name;
  templateMeta.textContent = `${getTemplateTargetLabel(profile.target || 'all')} • ${profile.category || 'Uncategorized'}`;
  templateBanner.style.setProperty('--headmate-color', profile.color || '#6c63ff');

  templateProfileGrid.innerHTML = templateFieldSchema.map((field) => {
    const rawValue = String(profile[field.key] ?? 'Not set');
    const value = field.key === 'color' ? escapeHtml(rawValue) : renderMarkdown(rawValue);
    return `<article class="headmate-field"><span class="headmate-field-label">${field.label}</span><div class="headmate-field-value">${value}</div></article>`;
  }).join('');

  templateProfile.hidden = false;
}

function renderTemplatesTable(filterValue = '') {
  if (!templatesTableBody) return;

  const entries = Object.entries(customTemplates);
  const query = filterValue.trim().toLowerCase();
  const filtered = query
    ? entries.filter(([, profile]) =>
      profile.name.toLowerCase().includes(query) ||
      (profile.category || '').toLowerCase().includes(query) ||
      (profile.target || '').toLowerCase().includes(query)
    )
    : entries;

  templatesTableBody.innerHTML = filtered.length
    ? filtered.map(([key, profile], index) => `
      <tr data-template="${key}" class="${selectedTemplateKey === key ? 'selected' : ''}">
        <td>#${String(index + 1).padStart(3, '0')}</td>
        <td>${escapeHtml(profile.name)}</td>
        <td>${escapeHtml(profile.target || 'all')}</td>
        <td>${escapeHtml(profile.category || 'Not set')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4">No templates found.</td></tr>';

  if (selectedTemplateKey && customTemplates[selectedTemplateKey]) {
    renderTemplateProfile(customTemplates[selectedTemplateKey]);
  } else {
    if (templateProfile) templateProfile.hidden = true;
    if (templateEditor) templateEditor.hidden = true;
    if (saveTemplateBtn) saveTemplateBtn.disabled = true;
  }
}

if (templatesTableBody) {
  templatesTableBody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-template]');
    if (!row) return;
    const key = row.dataset.template;
    const profile = customTemplates[key];
    if (!profile) return;

    document.querySelectorAll('#templatesTableBody tr[data-template]').forEach((r) => r.classList.remove('selected'));
    row.classList.add('selected');
    selectedTemplateKey = key;
    creatingTemplate = false;
    if (saveTemplateBtn) saveTemplateBtn.disabled = true;
    if (templateEditor) templateEditor.hidden = true;
    renderTemplateProfile(profile);
  });
}

if (templatesSearch) {
  templatesSearch.addEventListener('input', () => {
    renderTemplatesTable(templatesSearch.value);
  });
}

function startTemplateCreation(target = 'all') {
  creatingTemplate = true;
  selectedTemplateKey = null;
  const normalizedTarget = normalizeTemplateTarget(target || 'all');
  const label = getTemplateTargetLabel(normalizedTarget);
  const defaultName = `${label} Template ${Object.keys(customTemplates).length + 1}`;
  const seed = createDefaultTemplate(defaultName, normalizedTarget);
  renderTemplateProfile(seed);
  renderTemplateEditorFields(seed);
  if (saveTemplateBtn) saveTemplateBtn.disabled = false;
  if (templateEditor) {
    templateEditor.hidden = false;
    templateEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

if (addTemplateBtn) {
  addTemplateBtn.addEventListener('click', () => {
    startTemplateCreation('all');
  });
}

if (templateTargetButtons?.length) {
  templateTargetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      startTemplateCreation(button.dataset.templateTargetButton || 'all');
    });
  });
}

if (editTemplateBtn) {
  editTemplateBtn.addEventListener('click', () => {
    if (!selectedTemplateKey || !customTemplates[selectedTemplateKey]) {
      safeAlert('Select a template first.');
      return;
    }
    creatingTemplate = false;
    renderTemplateEditorFields(customTemplates[selectedTemplateKey]);
    if (saveTemplateBtn) saveTemplateBtn.disabled = false;
    if (templateEditor) {
      templateEditor.hidden = false;
      templateEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (saveTemplateBtn) {
  saveTemplateBtn.addEventListener('click', () => {
    const base = creatingTemplate
      ? createDefaultTemplate('Template')
      : customTemplates[selectedTemplateKey];
    if (!base) return;

    const updated = readTemplateEditorValues(base);
    const name = (updated.name || '').trim();
    if (!name) {
      safeAlert('Template name is required.');
      return;
    }

    if (creatingTemplate) {
      const baseKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `template-${Date.now()}`;
      let key = baseKey;
      let suffix = 2;
      while (customTemplates[key]) {
        key = `${baseKey}-${suffix}`;
        suffix += 1;
      }
      customTemplates[key] = updated;
      selectedTemplateKey = key;
      creatingTemplate = false;
    } else {
      customTemplates[selectedTemplateKey] = updated;
    }

    if (templateEditor) templateEditor.hidden = true;
    if (saveTemplateBtn) saveTemplateBtn.disabled = true;
    renderTemplatesTable(templatesSearch?.value || '');
  });
}

if (deleteTemplateBtn) {
  deleteTemplateBtn.addEventListener('click', () => {
    if (!selectedTemplateKey || !customTemplates[selectedTemplateKey]) {
      safeAlert('Select a template first.');
      return;
    }
    const templateToDelete = customTemplates[selectedTemplateKey];
    if (!safeConfirm(`Delete template "${templateToDelete.name}"?`)) return;
    delete customTemplates[selectedTemplateKey];
    selectedTemplateKey = null;
    creatingTemplate = false;
    if (templateEditor) templateEditor.hidden = true;
    if (templateProfile) templateProfile.hidden = true;
    if (saveTemplateBtn) saveTemplateBtn.disabled = true;
    renderTemplatesTable(templatesSearch?.value || '');
  });
}

renderTemplatesTable();

// =====================
// Journal: Log shortcuts with preset text
// =====================
const addJournalEntryBtn = document.getElementById('addJournalEntryBtn');
const addLogShortcutBtn = document.getElementById('addLogShortcutBtn');
const logShortcutEditor = document.getElementById('logShortcutEditor');
const logShortcutLabelInput = document.getElementById('logShortcutLabelInput');
const logShortcutModuleSelect = document.getElementById('logShortcutModuleSelect');
const logShortcutTextInput = document.getElementById('logShortcutTextInput');
const saveLogShortcutBtn = document.getElementById('saveLogShortcutBtn');
const cancelLogShortcutBtn = document.getElementById('cancelLogShortcutBtn');
const logShortcutsList = document.getElementById('logShortcutsList');
const journalList = document.getElementById('journalList');
const journalEmptyHint = document.getElementById('journalEmptyHint');
const journalSearchInput = document.getElementById('journalSearchInput');
const journalFilterSelect = document.getElementById('journalFilterSelect');
const journalSortSelect = document.getElementById('journalSortSelect');

const journalEntriesByUser = {};
const journalShortcutsByUser = {};

const logModules = [
  'Overview',
  'Headmates',
  'System',
  'Partners',
  'Subsystems',
  'Items',
  'Inner Chat',
  'Messages',
  'Health',
  'Rules',
  'Media Library',
  'Forms'
];

function ensureJournalEntryStore(userName) {
  if (!journalEntriesByUser[userName]) journalEntriesByUser[userName] = [];
  return journalEntriesByUser[userName];
}

function ensureJournalShortcutStore(userName) {
  if (!journalShortcutsByUser[userName]) {
    journalShortcutsByUser[userName] = [
      {
        id: `shortcut-${Date.now()}-overview`,
        label: 'Daily System Check-In',
        module: 'Overview',
        presetText: 'Summary:\nMood/energy:\nMain events:\nNext steps:'
      },
      {
        id: `shortcut-${Date.now()}-health`,
        label: 'Medication Note',
        module: 'Health',
        presetText: 'Medication update:\nDose/time:\nEffects:\nFollow-up:'
      }
    ];
  }
  return journalShortcutsByUser[userName];
}

function formatJournalDate(ts) {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function addJournalEntry(title, body, tag) {
  const entries = ensureJournalEntryStore(getActiveUserName());
  entries.unshift({
    id: `journal-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    title: title || 'Untitled Log',
    body: body || 'No details provided.',
    tag: tag || getActiveUserName(),
    createdAt: Date.now(),
    favorite: false,
    pinned: false
  });
  renderJournalModule();
}

function getFilteredJournalEntries() {
  const entries = [...ensureJournalEntryStore(getActiveUserName())];
  const query = (journalSearchInput?.value || '').trim().toLowerCase();
  const filterValue = journalFilterSelect?.value || 'all';
  const sortValue = journalSortSelect?.value || 'newest';

  const filtered = entries.filter((entry) => {
    const matchesQuery = !query || [entry.title, entry.body, entry.tag]
      .some((value) => String(value || '').toLowerCase().includes(query));
    const matchesFilter = filterValue === 'all'
      ? true
      : filterValue === 'favorites'
        ? Boolean(entry.favorite)
        : filterValue === 'pinned'
          ? Boolean(entry.pinned)
          : true;
    return matchesQuery && matchesFilter;
  });

  filtered.sort((a, b) => {
    const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDiff) return pinDiff;
    if (sortValue === 'oldest') return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    if (sortValue === 'az') return String(a.title || '').localeCompare(String(b.title || ''));
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });

  return filtered;
}

function renderJournalEntries() {
  if (!journalList) return;
  const allEntries = ensureJournalEntryStore(getActiveUserName());
  const entries = getFilteredJournalEntries();

  if (!allEntries.length) {
    journalList.innerHTML = '';
    if (journalEmptyHint) {
      journalEmptyHint.textContent = 'No journal entries yet. Add one to get started.';
      journalEmptyHint.hidden = false;
    }
    renderDashboard();
    return;
  }

  if (!entries.length) {
    journalList.innerHTML = '<div class="journal-card"><p>No journal entries match the current search or filter.</p></div>';
    if (journalEmptyHint) journalEmptyHint.hidden = true;
    renderDashboard();
    return;
  }

  if (journalEmptyHint) journalEmptyHint.hidden = true;
  journalList.innerHTML = entries.map((entry) => `
    <div class="journal-card ${entry.pinned ? 'is-pinned' : ''} ${entry.favorite ? 'is-favorite' : ''}" data-journal-id="${entry.id}">
      <div class="journal-meta">
        <span class="journal-date">${escapeHtml(formatJournalDate(entry.createdAt))}</span>
        <span class="badge">${escapeHtml(entry.tag)}</span>
        ${entry.favorite ? '<span class="badge">★ Favorite</span>' : ''}
        ${entry.pinned ? '<span class="badge">📌 Pinned</span>' : ''}
      </div>
      <h3>${escapeHtml(entry.title)}</h3>
      <div class="journal-body-text">${renderMarkdown(entry.body)}</div>
      <div class="journal-card-actions">
        <button class="btn-sm" type="button" data-journal-action="favorite" data-journal-id="${entry.id}">${entry.favorite ? '★ Favorited' : '☆ Favorite'}</button>
        <button class="btn-sm" type="button" data-journal-action="pin" data-journal-id="${entry.id}">${entry.pinned ? '📌 Pinned' : 'Pin'}</button>
        <button class="btn-sm" type="button" data-journal-action="edit" data-journal-id="${entry.id}">Edit</button>
        <button class="btn-sm" type="button" data-journal-action="delete" data-journal-id="${entry.id}">Delete</button>
      </div>
    </div>
  `).join('');

  renderDashboard();
}

function renderLogShortcuts() {
  if (!logShortcutsList) return;
  const shortcuts = ensureJournalShortcutStore(getActiveUserName());
  if (!shortcuts.length) {
    logShortcutsList.innerHTML = '<p class="headmate-hint" style="margin:8px 0">No shortcuts yet.</p>';
    return;
  }

  logShortcutsList.innerHTML = shortcuts.map((shortcut) => `
    <div class="log-shortcut-chip" data-shortcut-id="${shortcut.id}">
      <button class="btn-sm" type="button" data-log-shortcut-action="run" data-shortcut-id="${shortcut.id}">${escapeHtml(shortcut.label)}</button>
      <span>${escapeHtml(shortcut.module)}</span>
      <button class="btn-sm" type="button" data-log-shortcut-action="delete" data-shortcut-id="${shortcut.id}" title="Delete shortcut">&#10005;</button>
    </div>
  `).join('');
}

function renderJournalModule() {
  if (logShortcutModuleSelect) {
    logShortcutModuleSelect.innerHTML = logModules
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join('');
  }
  renderLogShortcuts();
  renderJournalEntries();
}

if (addJournalEntryBtn) {
  addJournalEntryBtn.addEventListener('click', () => {
    const title = safePrompt('Entry title:', 'Manual Journal Entry');
    if (!title || !title.trim()) return;
    const text = safePrompt('Entry text:', '');
    if (text === null || text === undefined) return;
    addJournalEntry(title.trim(), (text || '').trim() || 'No details provided.', getActiveUserName());
  });
}

if (addLogShortcutBtn) {
  addLogShortcutBtn.addEventListener('click', () => {
    if (logShortcutEditor) logShortcutEditor.hidden = false;
    if (logShortcutLabelInput) logShortcutLabelInput.value = '';
    if (logShortcutTextInput) logShortcutTextInput.value = '';
    if (logShortcutModuleSelect && !logShortcutModuleSelect.value) {
      logShortcutModuleSelect.value = 'Overview';
    }
  });
}

if (saveLogShortcutBtn) {
  saveLogShortcutBtn.addEventListener('click', () => {
    const label = (logShortcutLabelInput?.value || '').trim();
    const moduleName = (logShortcutModuleSelect?.value || '').trim();
    const presetText = (logShortcutTextInput?.value || '').trim();

    if (!label || !moduleName || !presetText) {
      safeAlert('Please fill in label, module, and preset text.');
      return;
    }

    const shortcuts = ensureJournalShortcutStore(getActiveUserName());
    shortcuts.push({
      id: `shortcut-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      label,
      module: moduleName,
      presetText
    });

    if (logShortcutEditor) logShortcutEditor.hidden = true;
    renderLogShortcuts();
  });
}

if (cancelLogShortcutBtn) {
  cancelLogShortcutBtn.addEventListener('click', () => {
    if (logShortcutEditor) logShortcutEditor.hidden = true;
  });
}

if (logShortcutsList) {
  logShortcutsList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-log-shortcut-action]');
    if (!button) return;

    const action = button.dataset.logShortcutAction;
    const shortcutId = button.dataset.shortcutId;
    if (!shortcutId) return;

    const shortcuts = ensureJournalShortcutStore(getActiveUserName());
    const index = shortcuts.findIndex((shortcut) => shortcut.id === shortcutId);
    if (index < 0) return;

    if (action === 'run') {
      const shortcut = shortcuts[index];
      addJournalEntry(`${shortcut.module} Log: ${shortcut.label}`, shortcut.presetText, shortcut.module);
      return;
    }

    if (action === 'delete') {
      if (!safeConfirm(`Delete shortcut "${shortcuts[index].label}"?`)) return;
      shortcuts.splice(index, 1);
      renderLogShortcuts();
    }
  });
}

if (journalList) {
  journalList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-journal-action]');
    if (!button) return;

    const action = button.dataset.journalAction;
    const entryId = button.dataset.journalId;
    if (!entryId) return;

    const entries = ensureJournalEntryStore(getActiveUserName());
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;

    if (action === 'favorite') {
      entry.favorite = !entry.favorite;
      renderJournalEntries();
      return;
    }

    if (action === 'pin') {
      entry.pinned = !entry.pinned;
      renderJournalEntries();
      return;
    }

    if (action === 'edit') {
      const nextTitle = safePrompt('Edit entry title:', entry.title || 'Untitled Log');
      if (nextTitle === null || nextTitle === undefined || !nextTitle.trim()) return;
      const nextBody = safePrompt('Edit entry text:', entry.body || '');
      if (nextBody === null || nextBody === undefined) return;
      const nextTag = safePrompt('Edit tag/module:', entry.tag || getActiveUserName());
      entry.title = nextTitle.trim();
      entry.body = (nextBody || '').trim() || 'No details provided.';
      entry.tag = (nextTag || '').trim() || getActiveUserName();
      renderJournalEntries();
      return;
    }

    if (action === 'delete') {
      if (!safeConfirm(`Delete journal entry "${entry.title}"?`)) return;
      const index = entries.findIndex((item) => item.id === entryId);
      if (index >= 0) entries.splice(index, 1);
      renderJournalEntries();
    }
  });
}

[journalSearchInput, journalFilterSelect, journalSortSelect].forEach((el) => {
  if (!el) return;
  el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderJournalEntries);
});

renderJournalModule();

// =====================
// History: Timeline event manager
// =====================
const addHistoryEventBtn = document.getElementById('addHistoryEventBtn');
const historyEventEditor = document.getElementById('historyEventEditor');
const historyEventTitleInput = document.getElementById('historyEventTitleInput');
const historyEventDateInput = document.getElementById('historyEventDateInput');
const historyEventTypeInput = document.getElementById('historyEventTypeInput');
const historyEventNotesInput = document.getElementById('historyEventNotesInput');
const saveHistoryEventBtn = document.getElementById('saveHistoryEventBtn');
const cancelHistoryEventBtn = document.getElementById('cancelHistoryEventBtn');
const historyTimeline = document.getElementById('historyTimeline');
const historyEmptyHint = document.getElementById('historyEmptyHint');
const historySearchInput = document.getElementById('historySearchInput');
const historyFilterSelect = document.getElementById('historyFilterSelect');
const historySortSelect = document.getElementById('historySortSelect');

const historyEvents = [];

let editingHistoryEventId = null;
let creatingHistoryEvent = false;

function formatHistoryDate(dateValue) {
  if (!dateValue) return 'No date set';
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return parsed.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getSortedHistoryEvents(options = {}) {
  const query = options.ignoreFilters ? '' : (historySearchInput?.value || '').trim().toLowerCase();
  const filterValue = options.ignoreFilters ? 'all' : (historyFilterSelect?.value || 'all');
  const sortValue = options.ignoreFilters ? 'newest' : (historySortSelect?.value || 'newest');

  const filtered = [...historyEvents].filter((entry) => {
    const matchesQuery = !query || [entry.title, entry.notes, entry.type, entry.date]
      .some((value) => String(value || '').toLowerCase().includes(query));

    let matchesFilter = true;
    if (filterValue === 'favorites') matchesFilter = Boolean(entry.favorite);
    else if (filterValue === 'pinned') matchesFilter = Boolean(entry.pinned);
    else if (filterValue !== 'all') matchesFilter = String(entry.type || '').toLowerCase() === filterValue.toLowerCase();

    return matchesQuery && matchesFilter;
  });

  filtered.sort((a, b) => {
    const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDiff) return pinDiff;
    if (sortValue === 'oldest') return String(a.date || '').localeCompare(String(b.date || ''));
    if (sortValue === 'az') return String(a.title || '').localeCompare(String(b.title || ''));
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  return filtered;
}

function loadHistoryEditor(eventData) {
  historyEventTitleInput.value = eventData.title || '';
  historyEventDateInput.value = eventData.date || '';
  historyEventTypeInput.value = eventData.type || 'Event';
  historyEventNotesInput.value = eventData.notes || '';
}

function openHistoryEditor(eventData, isCreating) {
  creatingHistoryEvent = isCreating;
  editingHistoryEventId = isCreating ? null : eventData.id;
  loadHistoryEditor(eventData);
  if (historyEventEditor) {
    historyEventEditor.hidden = false;
    historyEventEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function closeHistoryEditor() {
  creatingHistoryEvent = false;
  editingHistoryEventId = null;
  if (historyEventEditor) historyEventEditor.hidden = true;
}

function renderHistoryTimeline() {
  if (!historyTimeline) return;
  const entries = getSortedHistoryEvents();

  if (!historyEvents.length) {
    historyTimeline.innerHTML = '';
    if (historyEmptyHint) {
      historyEmptyHint.textContent = 'No history events yet. Add one to build the timeline.';
      historyEmptyHint.hidden = false;
    }
    renderDashboard();
    return;
  }

  if (!entries.length) {
    historyTimeline.innerHTML = '<article class="history-event-card"><div class="history-event-body"><p>No history events match the current search or filter.</p></div></article>';
    if (historyEmptyHint) historyEmptyHint.hidden = true;
    renderDashboard();
    return;
  }

  if (historyEmptyHint) historyEmptyHint.hidden = true;
  historyTimeline.innerHTML = entries.map((entry) => `
    <article class="history-event-card ${entry.pinned ? 'is-pinned' : ''} ${entry.favorite ? 'is-favorite' : ''}" data-history-id="${entry.id}">
      <div class="history-event-marker"></div>
      <div class="history-event-body">
        <div class="history-event-meta">
          <span class="journal-date">${escapeHtml(formatHistoryDate(entry.date))}</span>
          <span class="badge">${escapeHtml(entry.type)}</span>
          ${entry.favorite ? '<span class="badge">★ Favorite</span>' : ''}
          ${entry.pinned ? '<span class="badge">📌 Pinned</span>' : ''}
        </div>
        <h3>${escapeHtml(entry.title)}</h3>
        <div class="history-event-text">${renderMarkdown(entry.notes || 'No notes provided.')}</div>
        <div class="history-event-actions">
          <button class="btn-sm" type="button" data-history-action="favorite" data-history-id="${entry.id}">${entry.favorite ? '★ Favorited' : '☆ Favorite'}</button>
          <button class="btn-sm" type="button" data-history-action="pin" data-history-id="${entry.id}">${entry.pinned ? '📌 Pinned' : 'Pin'}</button>
          <button class="btn-sm" type="button" data-history-action="edit" data-history-id="${entry.id}">Edit</button>
          <button class="btn-sm" type="button" data-history-action="delete" data-history-id="${entry.id}">Delete</button>
        </div>
      </div>
    </article>
  `).join('');

  renderDashboard();
}

if (addHistoryEventBtn) {
  addHistoryEventBtn.addEventListener('click', () => {
    openHistoryEditor({
      title: '',
      date: new Date().toISOString().slice(0, 10),
      type: 'Event',
      notes: ''
    }, true);
  });
}

if (saveHistoryEventBtn) {
  saveHistoryEventBtn.addEventListener('click', () => {
    const title = (historyEventTitleInput?.value || '').trim();
    const date = (historyEventDateInput?.value || '').trim();
    const type = (historyEventTypeInput?.value || '').trim();
    const notes = (historyEventNotesInput?.value || '').trim();

    if (!title || !date || !type) {
      safeAlert('Title, date, and event type are required.');
      return;
    }

    if (creatingHistoryEvent) {
      historyEvents.push({
        id: `history-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        title,
        date,
        type,
        notes,
        favorite: false,
        pinned: false
      });
    } else {
      const index = historyEvents.findIndex((entry) => entry.id === editingHistoryEventId);
      if (index < 0) return;
      historyEvents[index] = {
        ...historyEvents[index],
        title,
        date,
        type,
        notes
      };
    }

    closeHistoryEditor();
    renderHistoryTimeline();
  });
}

if (cancelHistoryEventBtn) {
  cancelHistoryEventBtn.addEventListener('click', closeHistoryEditor);
}

if (historyTimeline) {
  historyTimeline.addEventListener('click', (event) => {
    const button = event.target.closest('[data-history-action]');
    if (!button) return;
    const action = button.dataset.historyAction;
    const eventId = button.dataset.historyId;
    if (!eventId) return;

    const entry = historyEvents.find((item) => item.id === eventId);
    if (!entry) return;

    if (action === 'favorite') {
      entry.favorite = !entry.favorite;
      renderHistoryTimeline();
      return;
    }

    if (action === 'pin') {
      entry.pinned = !entry.pinned;
      renderHistoryTimeline();
      return;
    }

    if (action === 'edit') {
      openHistoryEditor(entry, false);
      return;
    }

    if (action === 'delete') {
      if (!safeConfirm(`Delete event "${entry.title}"?`)) return;
      const index = historyEvents.findIndex((item) => item.id === eventId);
      if (index >= 0) historyEvents.splice(index, 1);
      closeHistoryEditor();
      renderHistoryTimeline();
    }
  });
}

[historySearchInput, historyFilterSelect, historySortSelect].forEach((el) => {
  if (!el) return;
  el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderHistoryTimeline);
});

renderHistoryTimeline();
// =====================
// Account Profiles (global, not per system-user)
// =====================
const accounts = {};
let loggedInAccountKey = null;
let authToken = '';
let remoteAccountDirectory = [];
let remoteHubStateSaveTimer = null;
let lastRemoteHubStateText = '';
let lastRemoteAccountStateText = '';
let initialSessionSyncPending = false;
const ACCOUNT_STORAGE_KEY = 'ispd7.accounts.v1';
const ACCOUNT_SESSION_KEY = 'ispd7.session.v1';
const AUTH_TOKEN_KEY = 'ispd7.auth.token.v1';
const HUB_STATE_STORAGE_KEY = 'ispd7.hub.state.v1';

function cloneJsonData(value, fallback = {}) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch (_err) {
    return Array.isArray(fallback) ? [...fallback] : { ...fallback };
  }
}

function setAuthToken(token = '') {
  authToken = String(token || '').trim();
  try {
    if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (_err) {
    // Ignore storage issues in restricted browsing modes.
  }
}

function clearInvalidAccountSession(message = 'Your saved account session is no longer available. Please sign in again.') {
  if (!USE_BACKEND_AUTH) return;

  setAuthToken('');
  loggedInAccountKey = null;
  remoteAccountDirectory = [];
  lastRemoteHubStateText = '';
  persistAccountState();

  ['loginError', 'signupError', 'editError'].forEach((id) => {
    const field = document.getElementById(id);
    if (field && typeof showAccountError === 'function') showAccountError(field, message);
  });

  if (typeof setNoSystemSelected === 'function') setNoSystemSelected();
  if (typeof setAppLockState === 'function') setAppLockState();
  if (typeof renderAccountModule === 'function') renderAccountModule();
  if (typeof navigateTo === 'function') navigateTo('profile');
}

function normalizeRemoteAccount(account = {}, fallbackUsername = 'user') {
  const username = String(account.username || fallbackUsername || 'user').trim().toLowerCase();
  const displayName = String(account.name || username || 'User').trim() || 'User';
  return {
    username,
    name: displayName,
    description: account.description || 'No description set.',
    tags: account.tags || 'Not set',
    customFields: account.customFields || 'Not set',
    profilePhoto: account.profilePhoto || displayName[0]?.toUpperCase() || 'U',
    banner: account.banner || `${displayName} Banner`,
    color: account.color || '#6c63ff',
    friends: account.friends && typeof account.friends === 'object' ? { ...account.friends } : {},
    friendProfiles: Array.isArray(account.friendProfiles) ? account.friendProfiles.map((entry) => ({ ...entry })) : [],
    hubState: account.hubState && typeof account.hubState === 'object' ? cloneJsonData(account.hubState, {}) : {},
    viewerTrustLevel: normalizeAccountTrustLevel(account.viewerTrustLevel, 'private'),
    createdAt: account.createdAt || new Date().toISOString(),
    updatedAt: account.updatedAt || account.createdAt || new Date().toISOString()
  };
}

function buildRemoteAccountStatePayload(account = getCurrentAccountRecord()) {
  if (!account || typeof account !== 'object') return null;

  const username = String(account.username || loggedInAccountKey || 'user').trim().toLowerCase() || 'user';
  const name = String(account.name || username || 'User').trim() || 'User';
  return {
    name,
    description: String(account.description || 'No description set.'),
    tags: String(account.tags || 'Not set'),
    customFields: String(account.customFields || 'Not set'),
    profilePhoto: String(account.profilePhoto || name[0]?.toUpperCase() || 'U'),
    banner: String(account.banner || `${name} Banner`),
    color: String(account.color || '#6c63ff')
  };
}

function resolveHubStateSyncPreference(remoteAccount = {}, options = {}) {
  const remoteSnapshot = remoteAccount?.hubState && typeof remoteAccount.hubState === 'object' ? remoteAccount.hubState : null;
  const remoteCounts = remoteSnapshot ? getHubStateEntityCounts(remoteSnapshot) : { total: 0 };
  const normalizedRemoteUser = normalizeLookupName(remoteAccount?.username || loggedInAccountKey || '');
  const allowOwnerlessLocal = Boolean(options.allowOwnerlessLocal);

  let localSnapshot = null;
  try {
    localSnapshot = readStoredJsonWithBackup(HUB_STATE_STORAGE_KEY, HUB_STATE_BACKUP_KEY, null);
  } catch (_err) {
    localSnapshot = null;
  }

  const localOwner = normalizeLookupName(localSnapshot?.ownerAccountKey || '');
  const localHasOwner = Boolean(localOwner);
  const localMatchesAccount = localHasOwner && localOwner === normalizedRemoteUser;
  const localOwnerUnknown = !localHasOwner;
  const canUseLocalSnapshot = Boolean(localSnapshot && (localMatchesAccount || (allowOwnerlessLocal && localOwnerUnknown)));
  const localUpdatedAt = canUseLocalSnapshot ? new Date(localSnapshot?.updatedAt || 0).getTime() : 0;
  const remoteUpdatedAt = new Date(remoteSnapshot?.updatedAt || 0).getTime();
  const localCounts = canUseLocalSnapshot ? getHubStateEntityCounts(localSnapshot) : { total: 0 };

  return {
    localSnapshot: canUseLocalSnapshot ? localSnapshot : null,
    remoteSnapshot,
    localCounts,
    remoteCounts,
    shouldUseLocalSnapshot: canUseLocalSnapshot
      && localCounts.total > 0
      && localUpdatedAt > remoteUpdatedAt
      && localCounts.total >= remoteCounts.total,
    shouldProtectLocalFromEmptyRemote: canUseLocalSnapshot
      && localCounts.total > 0
      && remoteCounts.total === 0,
    localMatchesAccount,
    localOwnerUnknown
  };
}

async function finalizeRemoteAuthSuccess(result = {}, fallbackUsername = '', options = {}) {
  const localAccount = options.localAccount && typeof options.localAccount === 'object'
    ? cloneJsonData(options.localAccount, {})
    : null;
  const preserveLocalState = Boolean(options.preserveLocalState);
  const account = normalizeRemoteAccount(result.account, fallbackUsername);

  if (localAccount?.password && !account.password) {
    account.password = localAccount.password;
  }

  if (localAccount?.username && localAccount.username !== account.username) {
    delete accounts[localAccount.username];
  }

  accounts[account.username] = { ...(localAccount || {}), ...account };
  loggedInAccountKey = account.username;
  setAuthToken(result.token || '');
  lastRemoteAccountStateText = JSON.stringify(buildRemoteAccountStatePayload(accounts[account.username]) || {});
  persistAccountState();

  const syncPreference = resolveHubStateSyncPreference(accounts[account.username], {
    allowOwnerlessLocal: preserveLocalState
  });

  if ((syncPreference.shouldUseLocalSnapshot || syncPreference.shouldProtectLocalFromEmptyRemote) && syncPreference.localSnapshot) {
    applyHubStateSnapshot(syncPreference.localSnapshot, { persistLocal: true });
    const savedSnapshot = persistHubState({ immediate: true, allowDuringInit: true });
    lastRemoteHubStateText = JSON.stringify(savedSnapshot || syncPreference.localSnapshot || {});
  } else if (syncPreference.remoteSnapshot && typeof applyHubStateSnapshot === 'function') {
    applyHubStateSnapshot(syncPreference.remoteSnapshot, { persistLocal: true });
    lastRemoteHubStateText = JSON.stringify(syncPreference.remoteSnapshot || {});
  }

  await refreshAccountDirectoryFromBackend();
  renderAccountModule();
  return account;
}

async function promoteLocalAccountToCloud(username = '', password = '', localAccount = null) {
  const localRecord = localAccount && typeof localAccount === 'object' ? localAccount : accounts[username];
  if (!localRecord || typeof localRecord !== 'object') {
    throw new Error('No saved local account was found for that username on this device.');
  }
  if (localRecord.password && localRecord.password !== password) {
    throw new Error('Incorrect password.');
  }

  const result = await apiRequest('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

  return finalizeRemoteAuthSuccess(result, username, {
    localAccount: { ...localRecord, password: password || localRecord.password || '' },
    preserveLocalState: true
  });
}

function buildAccountStoragePayload(accountsMap = accounts) {
  const cachedAccounts = {};
  Object.entries(accountsMap || {}).forEach(([key, account]) => {
    if (!key || !account || typeof account !== 'object') return;
    const cachedAccount = cloneJsonData(account, {});
    const normalizedKey = String(cachedAccount.username || key || '').trim().toLowerCase();
    if (!normalizedKey) return;
    cachedAccount.username = normalizedKey;
    if (cachedAccount.hubState && typeof cachedAccount.hubState === 'object') {
      cachedAccount.hubState = {
        version: Number(cachedAccount.hubState.version || 1),
        updatedAt: cachedAccount.hubState.updatedAt || cachedAccount.updatedAt || new Date().toISOString(),
        activeUser: cachedAccount.hubState.activeUser || 'No system'
      };
    }
    cachedAccounts[normalizedKey] = cachedAccount;
  });
  return cachedAccounts;
}

function isBackendUnavailableError(error) {
  if (error?.isNetworkError) return true;
  const message = String(error?.message || '').trim().toLowerCase();
  return !error?.status && (
    !message
    || message === 'failed to fetch'
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
    || message.includes('timed out')
    || message.includes('could not be reached')
  );
}

function createBackendUnavailableError(path, originalError) {
  const error = new Error('The server could not be reached. Refresh once and try again — local browser save mode is still available.');
  error.path = path;
  error.status = originalError?.status;
  error.isNetworkError = true;
  error.cause = originalError;
  return error;
}

async function apiRequest(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error('Backend URL is not configured yet.');
  }

  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      keepalive: Boolean(options.keepalive)
    });
  } catch (error) {
    throw createBackendUnavailableError(path, error);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(data.error || 'Request failed.');
    const currentAccountRoute = path === '/api/me' || path.startsWith('/api/me/') || path === '/api/accounts';
    const shouldResetSession = USE_BACKEND_AUTH && currentAccountRoute && (
      response.status === 401 || (response.status === 404 && /account not found/i.test(message))
    );

    if (shouldResetSession) {
      clearInvalidAccountSession(
        response.status === 401
          ? 'Your sign-in expired. Please sign in again.'
          : 'That saved account was not found on the server. Please sign in again.'
      );
    }

    const error = new Error(
      shouldResetSession
        ? (response.status === 401
          ? 'Your sign-in expired. Please sign in again.'
          : 'That saved account was not found on the server. Please sign in again.')
        : message
    );
    error.status = response.status;
    error.path = path;
    throw error;
  }

  return data;
}

function persistAccountState() {
  try {
    const currentAccounts = buildAccountStoragePayload(accounts);

    writeStoredJsonWithBackup(ACCOUNT_STORAGE_KEY, ACCOUNT_STORAGE_BACKUP_KEY, currentAccounts, {
      maxBytes: Math.max(512 * 1024, MAX_SAFE_LOCAL_STATE_BYTES - (256 * 1024)),
      warningMessage: 'Uploaded media made the account cache too large, so a compact backup was saved to stop data wipes. Your core data will still persist.'
    });
  } catch (_err) {
    showStorageWarning('Some local data could not be cached because uploaded images/GIFs are too large. Smaller files or image URLs will save more reliably.');
  }

  try {
    if (loggedInAccountKey) {
      localStorage.setItem(ACCOUNT_SESSION_KEY, loggedInAccountKey);
    } else {
      localStorage.removeItem(ACCOUNT_SESSION_KEY);
    }
  } catch (_err) {
    // Ignore session persistence issues.
  }
}

function loadAccountState() {
  try {
    const savedAccounts = readStoredJsonWithBackup(ACCOUNT_STORAGE_KEY, ACCOUNT_STORAGE_BACKUP_KEY, {});
    if (savedAccounts && typeof savedAccounts === 'object' && !Array.isArray(savedAccounts)) {
      Object.entries(savedAccounts).forEach(([key, value]) => {
        if (!key || !value || typeof value !== 'object') return;
        const normalizedAccount = normalizeRemoteAccount(value, key);
        if (!normalizedAccount.username) return;
        accounts[normalizedAccount.username] = normalizedAccount;
      });
    }

    authToken = String(localStorage.getItem(AUTH_TOKEN_KEY) || '').trim();
    const savedSession = (localStorage.getItem(ACCOUNT_SESSION_KEY) || '').trim().toLowerCase();
    if (savedSession && (!USE_BACKEND_AUTH || authToken)) {
      if (!accounts[savedSession]) {
        accounts[savedSession] = normalizeRemoteAccount({ username: savedSession, name: savedSession }, savedSession);
      }
      loggedInAccountKey = savedSession;
    }
    initialSessionSyncPending = USE_BACKEND_AUTH && Boolean(authToken && loggedInAccountKey);
  } catch (_err) {
    loggedInAccountKey = null;
    authToken = '';
    initialSessionSyncPending = false;
  }
}

function isSignedIn() {
  return USE_BACKEND_AUTH
    ? Boolean(authToken && loggedInAccountKey)
    : Boolean(loggedInAccountKey && accounts[loggedInAccountKey]);
}

function setAppLockState() {
  const locked = !isSignedIn();
  const profileHeader = document.querySelector('#page-profile .page-header h1');

  document.body.classList.toggle('app-locked', false);

  navItems.forEach((item) => {
    const requiresAuth = item.dataset.module === 'accountFriends';
    const allowed = !requiresAuth || !locked;
    item.classList.toggle('nav-item-locked', !allowed);
    item.setAttribute('aria-disabled', String(!allowed));
  });

  quickBtns.forEach((btn) => {
    btn.disabled = false;
    btn.classList.remove('btn-disabled');
  });

  if (globalSearchInput) {
    globalSearchInput.disabled = false;
    globalSearchInput.placeholder = 'Search...';
  }

  if (userSwitcherBtn) {
    userSwitcherBtn.classList.toggle('disabled', locked);
    userSwitcherBtn.setAttribute('aria-disabled', String(locked));
  }

  if (profileHeader) {
    profileHeader.textContent = locked ? 'Sign In to Sync' : 'Member Profile';
  }

  if (locked) {
    userDropdown?.classList.remove('open');
    if (!document.querySelector('.module-page.active')) {
      const fallbackPage = document.getElementById('page-dashboard') || document.querySelector('.module-page');
      if (fallbackPage) fallbackPage.classList.add('active');
    }
  }
}

loadAccountState();

const accountLoginView = document.getElementById('accountLoginView');
const accountSignupView = document.getElementById('accountSignupView');
const accountProfileView = document.getElementById('accountProfileView');
const loginUsernameInput = document.getElementById('loginUsernameInput');
const loginPasswordInput = document.getElementById('loginPasswordInput');
const loginError = document.getElementById('loginError');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const showSignupBtn = document.getElementById('showSignupBtn');
const signupUsernameInput = document.getElementById('signupUsernameInput');
const signupPasswordInput = document.getElementById('signupPasswordInput');
const signupError = document.getElementById('signupError');
const signupSubmitBtn = document.getElementById('signupSubmitBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const accountBanner = document.getElementById('accountBanner');
const accountUsernameDisplay = document.getElementById('accountUsernameDisplay');
const accountDescriptionDisplay = document.getElementById('accountDescriptionDisplay');
const accountTagsDisplay = document.getElementById('accountTagsDisplay');
const accountCustomFieldsDisplay = document.getElementById('accountCustomFieldsDisplay');
const accountFriendsSummary = document.getElementById('accountFriendsSummary');
const accountFriendsList = document.getElementById('accountFriendsList');
const accountDirectoryList = document.getElementById('accountDirectoryList');
const friendUsernameInput = document.getElementById('friendUsernameInput');
const friendTrustLevelInput = document.getElementById('friendTrustLevelInput');
const friendError = document.getElementById('friendError');
const addAccountFriendBtn = document.getElementById('addAccountFriendBtn');
const openAccountFriendsTabBtn = document.getElementById('openAccountFriendsTabBtn');
const editAccountNameInput = document.getElementById('editAccountNameInput');
const editAccountUsernameInput = document.getElementById('editAccountUsernameInput');
const editAccountDescriptionInput = document.getElementById('editAccountDescriptionInput');
const editAccountTagsInput = document.getElementById('editAccountTagsInput');
const editAccountCustomFieldsInput = document.getElementById('editAccountCustomFieldsInput');
const editAccountPhotoInput = document.getElementById('editAccountPhotoInput');
const editAccountBannerInput = document.getElementById('editAccountBannerInput');
const editAccountColorInput = document.getElementById('editAccountColorInput');
const editPasswordInput = document.getElementById('editPasswordInput');
const editConfirmPasswordInput = document.getElementById('editConfirmPasswordInput');
const editError = document.getElementById('editError');
const saveAccountBtn = document.getElementById('saveAccountBtn');
const logoutBtn = document.getElementById('logoutBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

function showAccountError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.hidden = !msg;
}

function normalizeAccountTrustLevel(level, fallback = 'friends') {
  const normalized = String(level || '').trim().toLowerCase();
  return PRIVACY_LEVELS.includes(normalized) ? normalized : fallback;
}

function getCurrentAccountRecord() {
  return loggedInAccountKey && accounts[loggedInAccountKey] ? accounts[loggedInAccountKey] : null;
}

function getAccountFriendEntries(account = getCurrentAccountRecord()) {
  if (!account) return [];

  if (Array.isArray(account.friendProfiles) && account.friendProfiles.length) {
    return account.friendProfiles
      .map((entry) => ({
        username: String(entry.username || '').trim().toLowerCase(),
        name: String(entry.name || entry.username || 'Unknown account').trim(),
        trustLevel: normalizeAccountTrustLevel(entry.trustLevel, 'friends'),
        theirTrustLevel: normalizeAccountTrustLevel(entry.theirTrustLevel, ''),
        profilePhoto: entry.profilePhoto || String(entry.name || entry.username || '?').trim()[0]?.toUpperCase() || '?',
        color: entry.color || '#6c63ff'
      }))
      .filter((entry) => entry.username);
  }

  return Object.entries(account.friends || {}).map(([username, trustLevel]) => ({
    username,
    name: username,
    trustLevel: normalizeAccountTrustLevel(trustLevel, 'friends'),
    theirTrustLevel: '',
    profilePhoto: username[0]?.toUpperCase() || '?',
    color: '#6c63ff'
  }));
}

async function refreshAccountDirectoryFromBackend() {
  if (!USE_BACKEND_AUTH || !authToken) {
    remoteAccountDirectory = [];
    return;
  }

  try {
    const result = await apiRequest('/api/accounts');
    remoteAccountDirectory = Array.isArray(result.accounts)
      ? result.accounts.map((entry) => ({
          username: String(entry.username || '').trim().toLowerCase(),
          name: String(entry.name || entry.username || 'Unknown account').trim(),
          description: String(entry.description || 'No description set.'),
          tags: String(entry.tags || 'Not set'),
          profilePhoto: entry.profilePhoto || String(entry.name || entry.username || '?').trim()[0]?.toUpperCase() || '?',
          color: entry.color || '#6c63ff',
          trustLevel: normalizeAccountTrustLevel(entry.trustLevel, ''),
          theirTrustLevel: normalizeAccountTrustLevel(entry.theirTrustLevel, ''),
          createdAt: entry.createdAt || '',
          updatedAt: entry.updatedAt || ''
        }))
      : [];
  } catch (_err) {
    remoteAccountDirectory = [];
  }
}

function renderAccountFriendSection(account = getCurrentAccountRecord()) {
  if (!accountFriendsList || !accountFriendsSummary) return;

  if (!account) {
    accountFriendsSummary.textContent = 'Sign in to manage your account friends.';
    accountFriendsList.innerHTML = '<p class="headmate-hint" style="margin:0">Sign in to add, edit, or remove friends.</p>';
    if (accountDirectoryList) {
      accountDirectoryList.innerHTML = '<p class="headmate-hint" style="margin:0">Sign in to view other known accounts.</p>';
    }
    return;
  }

  const entries = getAccountFriendEntries(account);
  if (!entries.length) {
    accountFriendsSummary.textContent = 'No account friends linked yet. Add a username and choose the trust label you want them to have.';
    accountFriendsList.innerHTML = '<p class="headmate-hint" style="margin:0">No friend connections saved yet.</p>';
  } else {
    accountFriendsSummary.textContent = `${entries.length} account friend${entries.length === 1 ? '' : 's'} linked. Trust labels use the same privacy scale as the rest of the app.`;

    accountFriendsList.innerHTML = entries.map((entry) => {
      const selectedOptions = PRIVACY_LEVELS.filter((level) => level !== 'public')
        .map((level) => `<option value="${level}"${entry.trustLevel === level ? ' selected' : ''}>${level.charAt(0).toUpperCase() + level.slice(1)}</option>`)
        .join('');
      return `
        <article class="account-friend-card">
          <div class="account-friend-main">
            ${renderAvatarMarkup(entry.profilePhoto, entry.name[0]?.toUpperCase() || '?', entry.color || '#6c63ff', 'sm')}
            <div class="account-friend-meta">
              <strong>${escapeHtml(entry.name)}</strong>
              <span>@${escapeHtml(entry.username)}</span>
              <span>Your trust: ${escapeHtml(entry.trustLevel)}</span>
              ${entry.theirTrustLevel ? `<span>They set you as: ${escapeHtml(entry.theirTrustLevel)}</span>` : ''}
            </div>
          </div>
          <div class="account-friend-actions">
            <select class="setting-input" data-account-friend-trust="${escapeHtml(entry.username)}">${selectedOptions}</select>
            <button class="btn-sm" type="button" data-remove-account-friend="${escapeHtml(entry.username)}">Remove</button>
          </div>
        </article>
      `;
    }).join('');
  }

  if (!accountDirectoryList) return;

  const knownAccounts = (Array.isArray(remoteAccountDirectory) && remoteAccountDirectory.length ? remoteAccountDirectory : Object.values(accounts || {}))
    .map((entry) => ({
      username: String(entry?.username || '').trim().toLowerCase(),
      name: String(entry?.name || entry?.username || 'Unknown account').trim(),
      description: String(entry?.description || 'No description set.'),
      profilePhoto: entry?.profilePhoto || String(entry?.name || entry?.username || '?').trim()[0]?.toUpperCase() || '?',
      color: entry?.color || '#6c63ff',
      trustLevel: normalizeAccountTrustLevel(entry?.trustLevel, ''),
      theirTrustLevel: normalizeAccountTrustLevel(entry?.theirTrustLevel, '')
    }))
    .filter((entry, index, list) => entry.username && entry.username !== account.username && list.findIndex((item) => item.username === entry.username) === index)
    .sort((a, b) => String(a.name || a.username).localeCompare(String(b.name || b.username)));

  if (!knownAccounts.length) {
    accountDirectoryList.innerHTML = '<p class="headmate-hint" style="margin:0">No other accounts are available yet. Ask your friend to create an account first.</p>';
    return;
  }

  accountDirectoryList.innerHTML = knownAccounts.map((entry) => {
    const relationshipHint = entry.trustLevel
      ? `Current trust: ${entry.trustLevel}`
      : (entry.theirTrustLevel ? `They list you as: ${entry.theirTrustLevel}` : 'Ready to add as a friend');
    return `
      <article class="account-friend-card">
        <div class="account-friend-main">
          ${renderAvatarMarkup(entry.profilePhoto, entry.name[0]?.toUpperCase() || '?', entry.color || '#6c63ff', 'sm')}
          <div class="account-friend-meta">
            <strong>${escapeHtml(entry.name)}</strong>
            <span>@${escapeHtml(entry.username)}</span>
            <span>${escapeHtml(relationshipHint)}</span>
          </div>
        </div>
        <div class="account-friend-actions">
          <button class="btn-sm" type="button" data-prefill-account-friend="${escapeHtml(entry.username)}" data-prefill-account-trust="${escapeHtml(entry.trustLevel || 'friends')}">Add / Update</button>
        </div>
      </article>
    `;
  }).join('');
}

async function saveAccountFriendLink(targetUsername = '', trustLevel = 'friends', options = {}) {
  const account = getCurrentAccountRecord();
  if (!account) return;

  const cleanUsername = String(targetUsername || '').trim().replace(/^@+/, '').toLowerCase();
  const normalizedTrust = normalizeAccountTrustLevel(trustLevel, 'friends');
  const clearForm = Boolean(options.clearForm);
  const silent = Boolean(options.silent);

  if (!cleanUsername) {
    showAccountError(friendError, 'Enter a username to add as a friend.');
    return;
  }
  if (cleanUsername === account.username) {
    showAccountError(friendError, 'You cannot friend your own account.');
    return;
  }

  if (USE_BACKEND_AUTH) {
    try {
      const result = await apiRequest('/api/friends', {
        method: 'POST',
        body: JSON.stringify({ username: cleanUsername, trustLevel: normalizedTrust })
      });
      const savedAccount = normalizeRemoteAccount(result.account, account.username);
      accounts[savedAccount.username] = savedAccount;
      loggedInAccountKey = savedAccount.username;
      persistAccountState();
      await refreshAccountDirectoryFromBackend();
      showAccountError(friendError, '');
      if (clearForm && friendUsernameInput) friendUsernameInput.value = '';
      if (clearForm && friendTrustLevelInput) friendTrustLevelInput.value = 'friends';
      renderAccountModule();
      if (!silent) safeAlert(`Friend settings saved for @${cleanUsername}.`);
    } catch (err) {
      showAccountError(friendError, err.message || 'Could not update friend settings.');
    }
    return;
  }

  if (!accounts[cleanUsername]) {
    showAccountError(friendError, 'That username does not exist yet.');
    return;
  }

  account.friends = { ...(account.friends || {}), [cleanUsername]: normalizedTrust };
  account.friendProfiles = [];
  accounts[cleanUsername].friends = {
    ...(accounts[cleanUsername].friends || {}),
    [account.username]: normalizeAccountTrustLevel(accounts[cleanUsername].friends?.[account.username], 'friends')
  };
  accounts[cleanUsername].friendProfiles = [];
  persistAccountState();
  showAccountError(friendError, '');
  if (clearForm && friendUsernameInput) friendUsernameInput.value = '';
  if (clearForm && friendTrustLevelInput) friendTrustLevelInput.value = 'friends';
  renderAccountModule();
  if (!silent) safeAlert(`Friend settings saved for @${cleanUsername}.`);
}

async function removeAccountFriendLink(targetUsername = '') {
  const account = getCurrentAccountRecord();
  if (!account) return;

  const cleanUsername = String(targetUsername || '').trim().replace(/^@+/, '').toLowerCase();
  if (!cleanUsername) return;

  if (USE_BACKEND_AUTH) {
    try {
      const result = await apiRequest(`/api/friends/${encodeURIComponent(cleanUsername)}`, {
        method: 'DELETE'
      });
      const savedAccount = normalizeRemoteAccount(result.account, account.username);
      accounts[savedAccount.username] = savedAccount;
      loggedInAccountKey = savedAccount.username;
      persistAccountState();
      await refreshAccountDirectoryFromBackend();
      showAccountError(friendError, '');
      renderAccountModule();
      safeAlert(`Removed @${cleanUsername} from your friends.`);
    } catch (err) {
      showAccountError(friendError, err.message || 'Could not remove that friend.');
    }
    return;
  }

  if (account.friends) delete account.friends[cleanUsername];
  account.friendProfiles = [];
  if (accounts[cleanUsername]?.friends) delete accounts[cleanUsername].friends[account.username];
  if (accounts[cleanUsername]) accounts[cleanUsername].friendProfiles = [];
  persistAccountState();
  showAccountError(friendError, '');
  renderAccountModule();
  safeAlert(`Removed @${cleanUsername} from your friends.`);
}

function renderAccountModule() {
  if (!accountLoginView) return;

  if (loggedInAccountKey && accounts[loggedInAccountKey]) {
    const acct = accounts[loggedInAccountKey];
    accountLoginView.hidden = true;
    accountSignupView.hidden = true;
    accountProfileView.hidden = false;

    rebuildUserDropdownOptions(getActiveUserName() !== NO_SYSTEM_USER ? getActiveUserName() : Object.keys(systemProfiles)[0] || '');

    const name = (acct.name || acct.username || 'User').trim();
    const photo = (acct.profilePhoto || name[0] || 'U').trim();
    const initial = name[0]?.toUpperCase() || 'U';
    const color = acct.color || '#6c63ff';
    applyPhotoStyle(profileAvatar, photo, initial, color);
    if (accountBanner) {
      applyBannerStyle(accountBanner, acct.banner || '', color, '--headmate-color');
    }
    if (profileName) profileName.textContent = name;
    if (accountUsernameDisplay) accountUsernameDisplay.textContent = `@${acct.username}`;
    if (accountDescriptionDisplay) accountDescriptionDisplay.innerHTML = renderMarkdown(acct.description || 'No description set.');
    if (accountTagsDisplay) accountTagsDisplay.innerHTML = renderTagPills(acct.tags || '');
    if (accountCustomFieldsDisplay) {
      const customMarkup = renderCustomFieldArticles(acct).join('');
      accountCustomFieldsDisplay.innerHTML = customMarkup || '';
      accountCustomFieldsDisplay.hidden = !customMarkup;
    }
    renderAccountFriendSection(acct);
    renderMessagesModule();
    if (friendTrustLevelInput && !friendTrustLevelInput.value) friendTrustLevelInput.value = 'friends';
    if (editAccountNameInput) editAccountNameInput.value = name;
    if (editAccountUsernameInput) editAccountUsernameInput.value = acct.username || '';
    if (editAccountDescriptionInput) editAccountDescriptionInput.value = acct.description || '';
    if (editAccountTagsInput) editAccountTagsInput.value = acct.tags || '';
    if (editAccountCustomFieldsInput) editAccountCustomFieldsInput.value = acct.customFields || '';
    if (editAccountColorInput) {
      editAccountColorInput.value = normalizeHexColor(acct.color || '#6c63ff', '#6c63ff');
      syncColorValuePill(editAccountColorInput, '#6c63ff');
    }
    if (editAccountPhotoInput) {
      editAccountPhotoInput.value = acct.profilePhoto || initial;
      primeStoredMediaInput(editAccountPhotoInput);
    }
    if (editAccountBannerInput) {
      editAccountBannerInput.value = acct.banner || `${name} Banner`;
      primeStoredMediaInput(editAccountBannerInput);
    }
    if (editPasswordInput) editPasswordInput.value = '';
    if (editConfirmPasswordInput) editConfirmPasswordInput.value = '';
    showAccountError(editError, '');
  } else {
    accountLoginView.hidden = false;
    accountSignupView.hidden = true;
    accountProfileView.hidden = true;
    userDropdown?.querySelectorAll('.user-option[data-user]').forEach((option) => option.remove());
    setNoSystemSelected();
    if (loginUsernameInput) loginUsernameInput.value = '';
    if (loginPasswordInput) loginPasswordInput.value = '';
    showAccountError(loginError, '');
  }

  renderMessagesModule();
  if (typeof renderChatSidebar === 'function') renderChatSidebar();
  setAppLockState();
  renderDashboard();
}

if (showSignupBtn) {
  showSignupBtn.addEventListener('click', () => {
    if (accountLoginView) accountLoginView.hidden = true;
    if (accountSignupView) accountSignupView.hidden = false;
    if (signupUsernameInput) signupUsernameInput.value = '';
    if (signupPasswordInput) signupPasswordInput.value = '';
    showAccountError(signupError, '');
  });
}

if (showLoginBtn) {
  showLoginBtn.addEventListener('click', () => {
    if (accountSignupView) accountSignupView.hidden = true;
    if (accountLoginView) accountLoginView.hidden = false;
    showAccountError(loginError, '');
  });
}

if (loginSubmitBtn) {
  loginSubmitBtn.addEventListener('click', async () => {
    const username = (loginUsernameInput?.value || '').trim().toLowerCase();
    const password = loginPasswordInput?.value || '';
    if (!username || !password) {
      showAccountError(loginError, 'Please enter your username and password.');
      return;
    }

    if (USE_BACKEND_AUTH) {
      try {
        const result = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        await finalizeRemoteAuthSuccess(result, username, {
          localAccount: accounts[username],
          preserveLocalState: Boolean(accounts[username])
        });
        navigateTo('dashboard');
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          const acct = accounts[username];
          if (!acct) {
            showAccountError(loginError, 'The server is offline right now. Create an account below to sign in locally on this browser.');
            return;
          }
          if (acct.password && acct.password !== password) {
            showAccountError(loginError, 'Incorrect password.');
            return;
          }
          loggedInAccountKey = username;
          persistAccountState();
          renderAccountModule();
          safeAlert('Server offline — signed in locally on this browser instead.');
          navigateTo('dashboard');
          return;
        }
        if (err?.status === 404) {
          const localAccount = accounts[username];
          if (localAccount) {
            try {
              await promoteLocalAccountToCloud(username, password, localAccount);
              safeAlert('Your saved browser account is now connected to cloud sync.');
              navigateTo('dashboard');
              return;
            } catch (migrationError) {
              showAccountError(loginError, migrationError?.message || 'Could not connect your saved browser account to cloud sync yet.');
              return;
            }
          }
          showAccountError(loginError, 'No cloud account exists with that username yet. If this account was created during the sync outage, sign in once on the original device first so it can sync to the server.');
          return;
        }
        showAccountError(loginError, err.message || 'Sign-in failed.');
      }
      return;
    }

    const acct = accounts[username];
    if (!acct) {
      showAccountError(loginError, 'No account exists with that username.');
      return;
    }
    if (acct.password !== password) {
      showAccountError(loginError, 'Incorrect password.');
      return;
    }
    loggedInAccountKey = username;
    persistAccountState();
    renderAccountModule();
    navigateTo('dashboard');
  });
}

if (signupSubmitBtn) {
  signupSubmitBtn.addEventListener('click', async () => {
    const username = (signupUsernameInput?.value || '').trim().toLowerCase();
    const password = signupPasswordInput?.value || '';

    if (!username) { showAccountError(signupError, 'Username is required.'); return; }
    if (!/^[a-z0-9_-]{2,32}$/.test(username)) {
      showAccountError(signupError, 'Username must be 2–32 characters: letters, numbers, _ or -.');
      return;
    }
    if (accounts[username] && !USE_BACKEND_AUTH) { showAccountError(signupError, 'That username is already taken.'); return; }
    if (!password) { showAccountError(signupError, 'Password is required.'); return; }
    if (password.length < 6) { showAccountError(signupError, 'Password must be at least 6 characters.'); return; }

    if (USE_BACKEND_AUTH) {
      const existingLocalAccount = accounts[username];
      if (existingLocalAccount) {
        if (existingLocalAccount.password && existingLocalAccount.password !== password) {
          showAccountError(signupError, 'That username already exists on this device. Sign in with its existing password instead.');
          return;
        }
        try {
          await promoteLocalAccountToCloud(username, password, existingLocalAccount);
          safeAlert('Your saved browser account is now connected to cloud sync.');
          navigateTo('dashboard');
          return;
        } catch (err) {
          if (err?.status === 409) {
            showAccountError(signupError, 'That username is already taken. Sign in instead.');
            return;
          }
          if (!isBackendUnavailableError(err)) {
            showAccountError(signupError, err.message || 'Account creation failed.');
            return;
          }
        }
      }

      try {
        const result = await apiRequest('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        await finalizeRemoteAuthSuccess(result, username, {
          localAccount: accounts[username],
          preserveLocalState: Boolean(accounts[username])
        });
        navigateTo('dashboard');
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          if (accounts[username]) {
            showAccountError(signupError, 'That username already exists in this browser. Sign in instead.');
            return;
          }
          const palette = ['#6c63ff','#ff6584','#43d9ad','#f5a623','#a29bfe','#fd79a8','#0984e3','#e17055'];
          accounts[username] = {
            username,
            name: username,
            description: 'No description set.',
            tags: 'Not set',
            customFields: 'Not set',
            profilePhoto: username[0]?.toUpperCase() || 'U',
            banner: `${username} Banner`,
            password,
            color: palette[Object.keys(accounts).length % palette.length],
            friends: {},
            friendProfiles: [],
            createdAt: new Date().toISOString()
          };
          loggedInAccountKey = username;
          persistAccountState();
          renderAccountModule();
          safeAlert('Server offline — account created locally on this browser instead.');
          navigateTo('dashboard');
          return;
        }
        if (err?.status === 409) {
          showAccountError(signupError, 'That username is already taken. Sign in instead.');
          return;
        }
        showAccountError(signupError, err.message || 'Account creation failed.');
      }
      return;
    }

    const palette = ['#6c63ff','#ff6584','#43d9ad','#f5a623','#a29bfe','#fd79a8','#0984e3','#e17055'];
    accounts[username] = {
      username,
      name: username,
      description: 'No description set.',
      tags: 'Not set',
      customFields: 'Not set',
      profilePhoto: username[0]?.toUpperCase() || 'U',
      banner: `${username} Banner`,
      password,
      color: palette[Object.keys(accounts).length % palette.length],
      friends: {},
      friendProfiles: [],
      createdAt: new Date().toISOString()
    };
    loggedInAccountKey = username;
    persistAccountState();
    renderAccountModule();
    navigateTo('dashboard');
  });
}

if (addAccountFriendBtn) {
  addAccountFriendBtn.addEventListener('click', () => {
    saveAccountFriendLink(friendUsernameInput?.value || '', friendTrustLevelInput?.value || 'friends', { clearForm: true });
  });
}

if (friendUsernameInput) {
  friendUsernameInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addAccountFriendBtn?.click();
  });
}

if (accountFriendsList) {
  accountFriendsList.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('[data-remove-account-friend]');
    if (!removeBtn) return;
    removeAccountFriendLink(removeBtn.dataset.removeAccountFriend || '');
  });

  accountFriendsList.addEventListener('change', (event) => {
    const trustSelect = event.target.closest('[data-account-friend-trust]');
    if (!trustSelect) return;
    saveAccountFriendLink(trustSelect.dataset.accountFriendTrust || '', trustSelect.value, { silent: true });
  });
}

if (accountDirectoryList) {
  accountDirectoryList.addEventListener('click', (event) => {
    const prefillBtn = event.target.closest('[data-prefill-account-friend]');
    if (!prefillBtn) return;
    if (friendUsernameInput) {
      friendUsernameInput.value = prefillBtn.dataset.prefillAccountFriend || '';
      friendUsernameInput.focus();
    }
    if (friendTrustLevelInput) {
      friendTrustLevelInput.value = prefillBtn.dataset.prefillAccountTrust || 'friends';
    }
  });
}

if (openAccountFriendsTabBtn) {
  openAccountFriendsTabBtn.addEventListener('click', () => {
    navigateTo('accountFriends');
  });
}

if (saveAccountBtn) {
  saveAccountBtn.addEventListener('click', async (event) => {
    event?.preventDefault?.();
    if (!loggedInAccountKey || !accounts[loggedInAccountKey]) {
      showAccountError(editError, 'Sign in first to edit your member profile.');
      navigateTo('profile');
      return;
    }
    const current = accounts[loggedInAccountKey];
    const name = (editAccountNameInput?.value || '').trim();
    const username = (editAccountUsernameInput?.value || '').trim().toLowerCase();
    const description = (editAccountDescriptionInput?.value || '').trim();
    const tags = (editAccountTagsInput?.value || '').trim();
    const customFields = (editAccountCustomFieldsInput?.value || '').trim();
    const profilePhoto = getEditorInputValue(editAccountPhotoInput);
    const banner = getEditorInputValue(editAccountBannerInput);
    const accountColor = normalizeHexColor(editAccountColorInput?.value || current.color || '#6c63ff', current.color || '#6c63ff');
    const newPassword = editPasswordInput?.value || '';
    const confirmPassword = editConfirmPasswordInput?.value || '';

    if (!name) { showAccountError(editError, 'Name is required.'); return; }
    if (!username) { showAccountError(editError, 'Username is required.'); return; }
    if (!/^[a-z0-9_-]{2,32}$/.test(username)) {
      showAccountError(editError, 'Username must be 2–32 characters: letters, numbers, _ or -.');
      return;
    }
    if (username !== loggedInAccountKey && accounts[username] && !USE_BACKEND_AUTH) {
      showAccountError(editError, 'That username is already taken.');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      showAccountError(editError, 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      showAccountError(editError, 'Passwords do not match.');
      return;
    }

    const updated = {
      ...current,
      username,
      name,
      description: description || 'No description set.',
      tags: tags || 'Not set',
      customFields: customFields || 'Not set',
      profilePhoto: profilePhoto || (name[0]?.toUpperCase() || 'U'),
      banner: banner || `${name} Banner`,
      color: accountColor
    };

    if (USE_BACKEND_AUTH) {
      try {
        const result = await apiRequest('/api/me', {
          method: 'PUT',
          body: JSON.stringify({
            username,
            name,
            description: updated.description,
            tags: updated.tags,
            customFields: updated.customFields,
            profilePhoto: updated.profilePhoto,
            banner: updated.banner,
            color: updated.color,
            newPassword: newPassword || undefined
          })
        });
        const savedAccount = normalizeRemoteAccount(result.account, username);
        delete accounts[loggedInAccountKey];
        accounts[savedAccount.username] = savedAccount;
        loggedInAccountKey = savedAccount.username;
        if (result.token) setAuthToken(result.token);
        if (savedAccount.hubState && typeof applyHubStateSnapshot === 'function') {
          applyHubStateSnapshot(savedAccount.hubState, { persistLocal: true });
          lastRemoteHubStateText = JSON.stringify(savedAccount.hubState || {});
        }
        await refreshAccountDirectoryFromBackend();
        showAccountError(editError, '');
        persistAccountState();
        renderAccountModule();
        safeAlert('Profile saved.');
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          if (newPassword) updated.password = newPassword;

          if (username !== loggedInAccountKey) {
            delete accounts[loggedInAccountKey];
            accounts[username] = updated;
            loggedInAccountKey = username;
          } else {
            accounts[loggedInAccountKey] = updated;
          }

          showAccountError(editError, '');
          persistAccountState();
          if (typeof persistHubState === 'function') {
            persistHubState({ immediate: true, allowDuringInit: true, remote: false });
          }
          renderAccountModule();
          safeAlert('Profile saved locally because the server could not be reached.');
          return;
        }
        showAccountError(editError, err.message || 'Could not save profile.');
      }
      return;
    }

    if (newPassword) updated.password = newPassword;

    if (username !== loggedInAccountKey) {
      delete accounts[loggedInAccountKey];
      accounts[username] = updated;
      loggedInAccountKey = username;
    } else {
      accounts[loggedInAccountKey] = updated;
    }

    showAccountError(editError, '');
    persistAccountState();
    if (typeof persistHubState === 'function') {
      persistHubState({ immediate: true, allowDuringInit: true, remote: false });
    }
    renderAccountModule();
    const successMessage = (!USE_BACKEND_AUTH && !updated.password)
      ? 'Profile saved locally. Set a new password once if you want this browser to sign in with that account later.'
      : 'Profile saved.';
    safeAlert(successMessage);
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    loggedInAccountKey = null;
    setAuthToken('');
    persistAccountState();
    renderAccountModule();
    navigateTo('profile');
  });
}

if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener('click', async () => {
    if (!loggedInAccountKey || !accounts[loggedInAccountKey]) return;
    const acct = accounts[loggedInAccountKey];
    if (!safeConfirm(`Delete account "${acct.name || acct.username}"? This cannot be undone.`)) return;

    if (USE_BACKEND_AUTH) {
      try {
        await apiRequest('/api/me', { method: 'DELETE' });
      } catch (err) {
        if (!isBackendUnavailableError(err)) {
          showAccountError(editError, err.message || 'Could not delete account.');
          return;
        }
        safeAlert('Server offline — removing the account from this browser only.');
      }
    }

    delete accounts[loggedInAccountKey];
    loggedInAccountKey = null;
    setAuthToken('');
    persistAccountState();
    renderAccountModule();
    navigateTo('profile');
  });
}

renderAccountModule();

// =====================
// Settings Module
// =====================

const THEME_TOKEN_META = [
  { key: '--bg', label: 'Background' },
  { key: '--surface', label: 'Surface' },
  { key: '--surface2', label: 'Surface 2' },
  { key: '--border', label: 'Border' },
  { key: '--text', label: 'Text' },
  { key: '--text-muted', label: 'Text Muted' },
  { key: '--accent', label: 'Accent' },
  { key: '--accent-light', label: 'Accent Light' },
  { key: '--danger', label: 'Danger' },
  { key: '--success', label: 'Success' }
];

const BASE_LIGHT_THEME = {
  '--bg': '#f0f2f5',
  '--surface': '#ffffff',
  '--surface2': '#f8f9fb',
  '--border': '#e2e6ea',
  '--text': '#1a1d23',
  '--text-muted': '#6b7280',
  '--accent': '#6c63ff',
  '--accent-light': '#ede9ff',
  '--danger': '#e53e3e',
  '--success': '#22c55e'
};

const BASE_DARK_THEME = {
  '--bg': '#12141a',
  '--surface': '#1e2029',
  '--surface2': '#252731',
  '--border': '#2e3140',
  '--text': '#e8eaf0',
  '--text-muted': '#9099b0',
  '--accent': '#8b85ff',
  '--accent-light': '#232040',
  '--danger': '#f87171',
  '--success': '#4ade80'
};

let customThemeTokens = {
  light: { ...BASE_LIGHT_THEME },
  dark: { ...BASE_DARK_THEME }
};

const LIGHT_THEME_PRESETS = {
  'default-light': { ...BASE_LIGHT_THEME, '--accent': '#6c63ff', '--accent-light': '#e7f7f7' },
  'pastel-rainbow': {
    '--bg': '#fff2f2',
    '--surface': '#fff8ee',
    '--surface2': '#fffde2',
    '--border': '#bde9c8',
    '--text': '#24326a',
    '--text-muted': '#6b56a6',
    '--accent': '#4a8dff',
    '--accent-light': '#e7f2ff',
    '--danger': '#ff4f5e',
    '--success': '#2ccf73'
  },
  'valentine-light': { '--bg': '#fff4f8', '--surface': '#ffffff', '--surface2': '#ffe9f1', '--border': '#f6cfe0', '--text': '#5e2f46', '--text-muted': '#a86586', '--accent': '#f472b6', '--accent-light': '#ffe3f1', '--danger': '#ec4899', '--success': '#fb7185' },
  'neon-rainbow': {
    '--bg': '#fff1f1',
    '--surface': '#fff6eb',
    '--surface2': '#fffbd5',
    '--border': '#91e7a9',
    '--text': '#1b2057',
    '--text-muted': '#6a5bcb',
    '--accent': '#00a6ff',
    '--accent-light': '#d9f2ff',
    '--danger': '#ff2f58',
    '--success': '#00cf66'
  },
  'watermelon': { '--bg': '#f6fff7', '--surface': '#ffffff', '--surface2': '#eefbef', '--border': '#cfead3', '--text': '#2f4a3a', '--text-muted': '#678579', '--accent': '#f472b6', '--accent-light': '#ffe5ef', '--danger': '#ef4444', '--success': '#22c55e' },
  'sunset': { '--bg': '#fff4f8', '--surface': '#fffaf5', '--surface2': '#ffe9d6', '--border': '#ffd2c2', '--text': '#5b4a5f', '--text-muted': '#9b7f97', '--accent': '#ff9f68', '--accent-light': '#ffe2c8', '--danger': '#ff8fb1', '--success': '#8ecbff' },
  'ocean': { '--bg': '#f2f9ff', '--surface': '#ffffff', '--surface2': '#e9f4ff', '--border': '#cfe3f6', '--text': '#1f3f5b', '--text-muted': '#5d7f9b', '--accent': '#3b82f6', '--accent-light': '#dbeafe', '--danger': '#ef4444', '--success': '#0ea5e9' },
  'retro': { '--bg': '#e9ddc7', '--surface': '#ecd9bb', '--surface2': '#dcc39b', '--border': '#b89a6b', '--text': '#433321', '--text-muted': '#70593f', '--accent': '#9a5a16', '--accent-light': '#e7c88f', '--danger': '#b45309', '--success': '#58751a' },
  'greyscale-light': { '--bg': '#f7f7f8', '--surface': '#ffffff', '--surface2': '#f1f1f2', '--border': '#d9d9db', '--text': '#242426', '--text-muted': '#6d6d72', '--accent': '#737373', '--accent-light': '#e4e4e7', '--danger': '#a3a3a3', '--success': '#525252' },
  'matcha': { '--bg': '#f2fde8', '--surface': '#f7fff0', '--surface2': '#e8f7d8', '--border': '#bfdca3', '--text': '#2f4a22', '--text-muted': '#5f7f4b', '--accent': '#65a30d', '--accent-light': '#d9f2b4', '--danger': '#9a7b4f', '--success': '#4d7c0f' },
  'custom-light': null
};

const DARK_THEME_PRESETS = {
  'default-dark': { ...BASE_DARK_THEME, '--accent': '#8b85ff', '--accent-light': '#1f2a3b', '--success': '#2dd4bf' },
  'halloween': { '--bg': '#1a1224', '--surface': '#241532', '--surface2': '#2f1d3f', '--border': '#4b2f61', '--text': '#f7f0ff', '--text-muted': '#c7afd8', '--accent': '#f97316', '--accent-light': '#3f2a21', '--danger': '#ef4444', '--success': '#84cc16' },
  'valentine-dark': { '--bg': '#2a1020', '--surface': '#35162b', '--surface2': '#432039', '--border': '#6b2d57', '--text': '#ffe6f2', '--text-muted': '#d9a8c4', '--accent': '#ec4899', '--accent-light': '#5a2344', '--danger': '#fb7185', '--success': '#f472b6' },
  'hacker': { '--bg': '#060806', '--surface': '#0c120c', '--surface2': '#101a10', '--border': '#214421', '--text': '#c4ffc4', '--text-muted': '#79cc79', '--accent': '#84cc16', '--accent-light': '#1d2f12', '--danger': '#22c55e', '--success': '#a3e635' },
  'christmas': { '--bg': '#101a12', '--surface': '#18241a', '--surface2': '#223126', '--border': '#3b5a3f', '--text': '#f9f5e6', '--text-muted': '#d6c9a7', '--accent': '#facc15', '--accent-light': '#3a361a', '--danger': '#8b1e3f', '--success': '#16a34a' },
  'greyscale-dark': { '--bg': '#121212', '--surface': '#1d1d1d', '--surface2': '#262626', '--border': '#3f3f46', '--text': '#e5e5e5', '--text-muted': '#a1a1aa', '--accent': '#9ca3af', '--accent-light': '#2f3238', '--danger': '#d4d4d8', '--success': '#a3a3a3' },
  'forest': { '--bg': '#0f1a14', '--surface': '#16251c', '--surface2': '#1d3025', '--border': '#32513f', '--text': '#def3e3', '--text-muted': '#9fc4aa', '--accent': '#22c55e', '--accent-light': '#1b3528', '--danger': '#65a30d', '--success': '#4ade80' },
  'mystic': { '--bg': '#1b1226', '--surface': '#261934', '--surface2': '#342244', '--border': '#53356f', '--text': '#ffe8f7', '--text-muted': '#d3add2', '--accent': '#c084fc', '--accent-light': '#3b2a4f', '--danger': '#f472b6', '--success': '#a78bfa' },
  'dark-rainbow': {
    '--bg': '#170f23',
    '--surface': '#1f1833',
    '--surface2': '#1f2740',
    '--border': '#2f7b55',
    '--text': '#ffe8b9',
    '--text-muted': '#ffb16f',
    '--accent': '#4e8fff',
    '--accent-light': '#2a2f67',
    '--danger': '#ff5c4d',
    '--success': '#40d986'
  },
  'night-glow': { '--bg': '#1F1E2F', '--surface': '#2E3360', '--surface2': '#3d4273', '--border': '#6B79FF', '--text': '#FBEAFF', '--text-muted': '#F295C6', '--accent': '#9EE6CF', '--accent-light': '#2f3a58', '--danger': '#F295C6', '--success': '#9EE6CF' },
  'custom-dark': null
};

let selectedLightThemeKey = 'default-light';
let selectedDarkThemeKey = 'default-dark';

function applyThemePalette(palette) {
  const root = document.documentElement;
  Object.entries(palette.light).forEach(([cssVar, val]) => {
    root.style.setProperty(cssVar, val);
  });

  let styleTag = document.getElementById('themeOverrideStyle');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'themeOverrideStyle';
    document.head.appendChild(styleTag);
  }

  const darkVars = Object.entries(palette.dark)
    .map(([cssVar, val]) => `${cssVar}:${val};`)
    .join(' ');
  styleTag.textContent = `body.dark { ${darkVars} }`;
}

function renderThemeTokenGrid(mode, container) {
  if (!container) return;
  const palette = mode === 'light' ? customThemeTokens.light : customThemeTokens.dark;
  container.innerHTML = THEME_TOKEN_META.map((token) => {
    const value = normalizeHexColor(palette[token.key], mode === 'light' ? '#6c63ff' : '#8b85ff');
    return `
      <div class="theme-token-field">
        <input type="color" data-theme-mode="${mode}" data-theme-key="${token.key}" value="${value}" title="${escapeHtml(token.label)}" />
        <div class="theme-token-meta">
          <strong>${escapeHtml(token.label)}</strong>
          <span data-theme-value data-theme-mode="${mode}" data-theme-key="${token.key}">${escapeHtml(value.toUpperCase())}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderThemePreview(palette) {
  const themePreviewGrid = document.getElementById('themePreviewGrid');
  if (!themePreviewGrid) return;

  const mode = document.body.classList.contains('dark') ? 'dark' : 'light';
  const activePalette = (palette && palette[mode]) || (mode === 'dark' ? BASE_DARK_THEME : BASE_LIGHT_THEME);

  themePreviewGrid.innerHTML = THEME_TOKEN_META.map((token) => {
    const value = activePalette[token.key] || '#000000';
    return `
      <div class="theme-preview-chip">
        <div class="theme-preview-swatch" style="background:${escapeHtml(value)}"></div>
        <div class="theme-preview-meta">
          <strong>${escapeHtml(token.label)}</strong>
          <span>${escapeHtml(value)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function syncThemeTokenInputs(container) {
  if (!container) return;
  container.querySelectorAll('input[type="color"][data-theme-key]').forEach((picker) => {
    const mode = picker.getAttribute('data-theme-mode');
    const key = picker.getAttribute('data-theme-key');
    const valueLabel = container.querySelector(`span[data-theme-value][data-theme-mode="${mode}"][data-theme-key="${key}"]`);

    const syncValue = () => {
      const val = normalizeHexColor(picker.value, mode === 'light' ? '#6c63ff' : '#8b85ff');
      if (picker.value !== val) picker.value = val;
      if (valueLabel) valueLabel.textContent = val.toUpperCase();
    };

    syncValue();
    if (picker.dataset.themeBound === 'true') return;

    picker.addEventListener('input', syncValue);
    picker.addEventListener('change', syncValue);
    picker.dataset.themeBound = 'true';
  });
}

function applyThemeSelection() {
  const lightTheme = selectedLightThemeKey === 'custom-light'
    ? customThemeTokens.light
    : (LIGHT_THEME_PRESETS[selectedLightThemeKey] || LIGHT_THEME_PRESETS['default-light']);
  const darkTheme = selectedDarkThemeKey === 'custom-dark'
    ? customThemeTokens.dark
    : (DARK_THEME_PRESETS[selectedDarkThemeKey] || DARK_THEME_PRESETS['default-dark']);

  const palette = { light: lightTheme, dark: darkTheme };
  applyThemePalette(palette);
  renderThemePreview(palette);

  const customRow = document.getElementById('customThemeTokensRow');
  const customEnabled = selectedLightThemeKey === 'custom-light' || selectedDarkThemeKey === 'custom-dark';
  if (customRow) customRow.hidden = false;
  if (customThemeTokensHint) {
    customThemeTokensHint.textContent = customEnabled
      ? 'Custom theme is active. Use the 10 color pickers below for light and dark mode, then click Apply Custom Theme.'
      : 'Use the 10 color pickers below, then click Apply Custom Theme. The custom preset will activate automatically.';
  }

  renderThemeTokenGrid('light', customLightTokenGrid);
  renderThemeTokenGrid('dark', customDarkTokenGrid);
  syncThemeTokenInputs(customLightTokenGrid);
  syncThemeTokenInputs(customDarkTokenGrid);
}

const lightThemeSelect = document.getElementById('lightThemeSelect');
const darkThemeSelect = document.getElementById('darkThemeSelect');

if (lightThemeSelect) {
  lightThemeSelect.value = selectedLightThemeKey;
  lightThemeSelect.addEventListener('change', () => {
    selectedLightThemeKey = lightThemeSelect.value;
    // Picking a light preset should immediately preview in light mode.
    setDarkMode(false);
    applyThemeSelection();
  });
}

if (darkThemeSelect) {
  darkThemeSelect.value = selectedDarkThemeKey;
  darkThemeSelect.addEventListener('change', () => {
    selectedDarkThemeKey = darkThemeSelect.value;
    // Picking a dark preset should immediately preview in dark mode.
    setDarkMode(true);
    applyThemeSelection();
  });
}

const customLightTokenGrid = document.getElementById('customLightTokenGrid');
const customDarkTokenGrid = document.getElementById('customDarkTokenGrid');
const customThemeTokensHint = document.getElementById('customThemeTokensHint');
const applyCustomThemeTokensBtn = document.getElementById('applyCustomThemeTokensBtn');

if (applyCustomThemeTokensBtn) {
  applyCustomThemeTokensBtn.addEventListener('click', () => {
    const readTokens = (mode, container, base) => {
      const next = { ...base };
      if (!container) return next;
      THEME_TOKEN_META.forEach((token) => {
        const input = container.querySelector(`input[type="color"][data-theme-mode="${mode}"][data-theme-key="${token.key}"]`);
        if (!input) return;
        next[token.key] = normalizeHexColor(input.value.trim(), base[token.key]);
      });
      return next;
    };

    customThemeTokens = {
      light: readTokens('light', customLightTokenGrid, customThemeTokens.light),
      dark: readTokens('dark', customDarkTokenGrid, customThemeTokens.dark)
    };

    selectedLightThemeKey = 'custom-light';
    selectedDarkThemeKey = 'custom-dark';
    if (lightThemeSelect) lightThemeSelect.value = selectedLightThemeKey;
    if (darkThemeSelect) darkThemeSelect.value = selectedDarkThemeKey;

    if (document.body.classList.contains('dark')) {
      setDarkMode(true);
    } else {
      setDarkMode(false);
    }

    applyThemeSelection();
    if (typeof persistHubState === 'function') {
      persistHubState({ immediate: true, allowDuringInit: true, remote: false });
    }
    safeAlert('Custom theme saved.');
  });
}

// --- Hub Info ---
const hubSettings = { name: 'System Hub', description: '', icon: '' };
const appTitle     = document.getElementById('appTitle');
const hubNameInput = document.getElementById('hubNameInput');
const hubDescInput = document.getElementById('hubDescInput');
const hubIconInput = document.getElementById('hubIconInput');
const saveHubInfoBtn = document.getElementById('saveHubInfoBtn');
const termHeadmatesInput = document.getElementById('termHeadmatesInput');
const termSystemInput = document.getElementById('termSystemInput');
const termSubsystemInput = document.getElementById('termSubsystemInput');
const termInnerworldInput = document.getElementById('termInnerworldInput');
const termPartnersInput = document.getElementById('termPartnersInput');
const saveTerminologyBtn = document.getElementById('saveTerminologyBtn');

function applyHubInfo() {
  const display = (hubSettings.icon ? hubSettings.icon + ' ' : '') + (hubSettings.name || 'System Hub');
  if (appTitle) appTitle.textContent = display;
  document.title = hubSettings.name || 'System Hub';
}

function applyTerminology() {
  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  if (termHeadmatesInput) termHeadmatesInput.value = getTermLabel('headmates');
  if (termSystemInput) termSystemInput.value = getTermLabel('system');
  if (termSubsystemInput) termSubsystemInput.value = getTermLabel('subsystem');
  if (termInnerworldInput) termInnerworldInput.value = getTermLabel('innerworld');
  if (termPartnersInput) termPartnersInput.value = getTermLabel('partners');

  setText('.nav-item[data-module="parts"] .nav-label', getTermLabel('headmates'));
  setText('.nav-item[data-module="system"] .nav-label', getTermLabel('system'));
  setText('.nav-item[data-module="friends"] .nav-label', getTermLabel('partners'));
  setText('.nav-item[data-module="partners"] .nav-label', getTermLabel('subsystem'));
  setText('.nav-item[data-module="journal"] .nav-label', `${getTermLabel('system')} Journal`);
  setText('.nav-item[data-module="chat"] .nav-label', `${getTermLabel('innerworld')} Chat`);
  setText('.nav-item[data-module="notifications"] .nav-label', getTermLabel('innerworld'));

  setText('#page-parts .page-header h1', getTermLabel('headmates'));
  setText('#page-system .page-header h1', getTermLabel('system'));
  setText('#page-friends .page-header h1', getTermLabel('partners'));
  setText('#page-partners .page-header h1', getTermLabel('subsystem'));
  setText('#page-journal .page-header h1', `${getTermLabel('system')} Journal`);
  setText('#page-chat .page-header h1', `${getTermLabel('innerworld')} Chat`);
  setText('#page-notifications .page-header h1', getTermLabel('innerworld'));

  setText('#headmateProfile .headmate-kicker', `${getSingularTerm('headmates')} Profile`);
  setText('#partnerProfile .headmate-kicker', `${getSingularTerm('partners')} Profile`);
  setText('#subsystemProfile .headmate-kicker', getSingularTerm('subsystem'));

  if (addHeadmateBtn) addHeadmateBtn.textContent = `+ Add ${getSingularTerm('headmates')}`;
  if (bulkAddHeadmatesBtn) bulkAddHeadmatesBtn.textContent = `Bulk Add ${getTermLabel('headmates')} by List`;
  if (linkHeadmateSubsystemBtn) linkHeadmateSubsystemBtn.textContent = `Link ${getSingularTerm('subsystem')}`;
  if (linkHeadmateBtn) linkHeadmateBtn.textContent = `+ Link ${getSingularTerm('headmates')}`;
  document.querySelector('.quick-btn[data-module="journal"]')?.replaceChildren(document.createTextNode(`${getTermLabel('system')} Journal`));

  setText('#partnerHeadmatesHub .subsystem-hub-header h3', `Their ${getTermLabel('headmates')}`);

  const privacyHeadmatesRow = document.getElementById('privHeadmatesVisible')?.closest('.setting-row');
  if (privacyHeadmatesRow?.firstElementChild) privacyHeadmatesRow.firstElementChild.textContent = `Show ${getSingularTerm('headmates').toLowerCase()} profiles to all users`;
  const privacyPartnersRow = document.getElementById('privPartnersVisible')?.closest('.setting-row');
  if (privacyPartnersRow?.firstElementChild) privacyPartnersRow.firstElementChild.textContent = `Show ${getSingularTerm('partners').toLowerCase()} profiles to all users`;
  const privacyLocationsRow = document.getElementById('privLocationsVisible')?.closest('.setting-row');
  if (privacyLocationsRow?.firstElementChild) privacyLocationsRow.firstElementChild.textContent = `Show ${getTermLabel('innerworld').toLowerCase()} to all users`;

  renderDashboard();
}


if (saveHubInfoBtn) {
  saveHubInfoBtn.addEventListener('click', () => {
    hubSettings.name        = (hubNameInput?.value || '').trim() || 'System Hub';
    hubSettings.description = (hubDescInput?.value || '').trim();
    hubSettings.icon        = (hubIconInput?.value || '').trim();
    applyHubInfo();
    if (typeof persistHubState === 'function') persistHubState();
    safeAlert('Hub info saved.');
  });
}

if (saveTerminologyBtn) {
  saveTerminologyBtn.addEventListener('click', () => {
    terminologySettings.headmates = (termHeadmatesInput?.value || '').trim() || DEFAULT_TERMINOLOGY.headmates;
    terminologySettings.system = (termSystemInput?.value || '').trim() || DEFAULT_TERMINOLOGY.system;
    terminologySettings.subsystem = (termSubsystemInput?.value || '').trim() || DEFAULT_TERMINOLOGY.subsystem;
    terminologySettings.innerworld = (termInnerworldInput?.value || '').trim() || DEFAULT_TERMINOLOGY.innerworld;
    terminologySettings.partners = (termPartnersInput?.value || '').trim() || DEFAULT_TERMINOLOGY.partners;
    applyTerminology();
    if (typeof renderHeadmatesTable === 'function') renderHeadmatesTable();
    if (typeof renderPartnersTable === 'function') renderPartnersTable();
    if (typeof renderSubsystemsGrid === 'function') renderSubsystemsGrid();
    if (typeof persistHubState === 'function') persistHubState();
    safeAlert('Terminology updated.');
  });
}

// Pre-fill hub info fields from current state
if (hubNameInput) hubNameInput.value = hubSettings.name;

const MODULE_VISIBILITY_DEFAULTS = {
  dashboard: true,
  parts: true,
  system: true,
  friends: true,
  accountFriends: true,
  partners: true,
  items: true,
  tags: true,
  journal: true,
  chat: true,
  messages: true,
  health: true,
  switchboard: true,
  gallery: true,
  templates: true,
  calendar: true,
  notifications: true
};

const moduleVisibilitySettings = { ...MODULE_VISIBILITY_DEFAULTS };
const moduleVisibilityToggleIds = [
  ['tabDashboardVisible', 'dashboard'],
  ['tabPartsVisible', 'parts'],
  ['tabSystemVisible', 'system'],
  ['tabPartnersVisible', 'friends'],
  ['tabAccountFriendsVisible', 'accountFriends'],
  ['tabSubsystemsVisible', 'partners'],
  ['tabItemsVisible', 'items'],
  ['tabTagsVisible', 'tags'],
  ['tabJournalVisible', 'journal'],
  ['tabChatVisible', 'chat'],
  ['tabMessagesVisible', 'messages'],
  ['tabHealthVisible', 'health'],
  ['tabRulesVisible', 'switchboard'],
  ['tabGalleryVisible', 'gallery'],
  ['tabTemplatesVisible', 'templates'],
  ['tabHistoryVisible', 'calendar'],
  ['tabInnerworldVisible', 'notifications']
];

function isModuleEnabled(module) {
  if (!module || module === 'profile' || module === 'settings') return true;
  return moduleVisibilitySettings[module] !== false;
}

function getFirstVisibleModule(preferred = 'dashboard') {
  if (isModuleEnabled(preferred)) return preferred;
  const nextItem = Array.from(navItems).find((item) => {
    const module = item.dataset.module;
    return module && module !== 'profile' && module !== 'settings' && isModuleEnabled(module);
  });
  return nextItem?.dataset.module || 'profile';
}

function healModuleVisibilitySettings() {
  const criticalModules = ['chat', 'messages', 'health', 'switchboard', 'gallery', 'templates', 'calendar', 'notifications'];
  const disabledCriticalCount = criticalModules.filter((key) => moduleVisibilitySettings[key] === false).length;

  if (disabledCriticalCount >= 3) {
    criticalModules.forEach((key) => {
      moduleVisibilitySettings[key] = true;
    });
  }
}

function applyModuleVisibilitySettings() {
  healModuleVisibilitySettings();
  navItems.forEach((item) => {
    const module = item.dataset.module;
    item.hidden = !isModuleEnabled(module);
  });

  quickBtns.forEach((btn) => {
    const module = btn.dataset.module;
    btn.hidden = !isModuleEnabled(module);
  });

  const activeModule = document.querySelector('.nav-item.active')?.dataset.module;
  if (activeModule && !isModuleEnabled(activeModule)) {
    navigateTo(getFirstVisibleModule('dashboard'));
  }
}

moduleVisibilityToggleIds.forEach(([id, key]) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = moduleVisibilitySettings[key];
  el.addEventListener('change', () => {
    moduleVisibilitySettings[key] = el.checked;
    applyModuleVisibilitySettings();
    if (typeof persistHubState === 'function') persistHubState();
  });
});

// --- Privacy & Safety ---
const privacySettings = {
  frontTracking:    true,
  headmatesVisible: true,
  healthVisible:    false,
  journalVisible:   false,
  partnersVisible:  true,
  historyVisible:   true,
  locationsVisible: true,
  cwDefault:        true,
  deleteConfirm:    true
};

const privacyToggleIds = [
  ['privFrontTracking',    'frontTracking'],
  ['privHeadmatesVisible', 'headmatesVisible'],
  ['privHealthVisible',    'healthVisible'],
  ['privJournalVisible',   'journalVisible'],
  ['privPartnersVisible',  'partnersVisible'],
  ['privHistoryVisible',   'historyVisible'],
  ['privLocationsVisible', 'locationsVisible'],
  ['privCWDefault',        'cwDefault'],
  ['privDeleteConfirm',    'deleteConfirm']
];

privacyToggleIds.forEach(([id, key]) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = privacySettings[key];
  el.addEventListener('change', () => {
    privacySettings[key] = el.checked;
    if (typeof persistHubState === 'function') persistHubState();
    renderDashboard();
  });
});

// --- Notifications ---
const notificationSettings = {
  journal:        true,
  meds:           true,
  chat:           true,
  history:        false,
  profileChanges: false
};

const notifToggleIds = [
  ['notifJournal',        'journal'],
  ['notifMeds',           'meds'],
  ['notifChat',           'chat'],
  ['notifHistory',        'history'],
  ['notifProfileChanges', 'profileChanges']
];

notifToggleIds.forEach(([id, key]) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = notificationSettings[key];
  el.addEventListener('change', () => {
    notificationSettings[key] = el.checked;
    if (typeof persistHubState === 'function') persistHubState();
  });
});

// --- Data Export / Import / Clear ---
const exportDataBtn = document.getElementById('exportDataBtn');
const importDataBtn = document.getElementById('importDataBtn');
const importDataFile = document.getElementById('importDataFile');
const clearDataBtn  = document.getElementById('clearDataBtn');

function buildPortableExportDump() {
  return {
    exportedAt: new Date().toISOString(),
    hubStateSnapshot: buildHubStateSnapshot(),
    hubSettings,
    privacySettings,
    notificationSettings,
    terminologySettings,
    moduleVisibilitySettings,
    systemProfiles,
    headmateProfilesByUser,
    headmateFoldersByUser,
    chatMessagesByUser,
    directMessagesByAccount,
    partnerProfiles,
    subsystemsByUser,
    itemProfiles,
    locationProfiles,
    medicationsByUser,
    medicationCheckinsByUser,
    journalEntriesByUser,
    journalShortcutsByUser,
    historyEvents,
    customTemplates,
    selectedLightThemeKey,
    selectedDarkThemeKey,
    customThemeTokens,
    accounts: Object.fromEntries(
      Object.entries(accounts).map(([k, v]) => [k, { ...v, password: '[redacted]' }])
    )
  };
}

function normalizeImportedHubPayload(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const snapshot = payload.hubStateSnapshot && typeof payload.hubStateSnapshot === 'object'
    ? payload.hubStateSnapshot
    : payload;

  return {
    version: Number(snapshot.version || 1),
    ownerAccountKey: String(snapshot.ownerAccountKey || payload.ownerAccountKey || loggedInAccountKey || '').trim().toLowerCase(),
    updatedAt: snapshot.updatedAt || payload.updatedAt || new Date().toISOString(),
    hubSettings: cloneJsonData(snapshot.hubSettings ?? payload.hubSettings ?? {}, {}),
    privacySettings: cloneJsonData(snapshot.privacySettings ?? payload.privacySettings ?? {}, {}),
    notificationSettings: cloneJsonData(snapshot.notificationSettings ?? payload.notificationSettings ?? {}, {}),
    terminologySettings: cloneJsonData(snapshot.terminologySettings ?? payload.terminologySettings ?? {}, {}),
    moduleVisibilitySettings: cloneJsonData(snapshot.moduleVisibilitySettings ?? payload.moduleVisibilitySettings ?? {}, {}),
    systemProfiles: cloneJsonData(snapshot.systemProfiles ?? payload.systemProfiles ?? {}, {}),
    headmateProfilesByUser: cloneJsonData(snapshot.headmateProfilesByUser ?? payload.headmateProfilesByUser ?? {}, {}),
    headmateFoldersByUser: cloneJsonData(snapshot.headmateFoldersByUser ?? payload.headmateFoldersByUser ?? {}, {}),
    chatMessagesByUser: cloneJsonData(snapshot.chatMessagesByUser ?? payload.chatMessagesByUser ?? {}, {}),
    directMessagesByAccount: cloneJsonData(snapshot.directMessagesByAccount ?? payload.directMessagesByAccount ?? {}, {}),
    partnerProfiles: cloneJsonData(snapshot.partnerProfiles ?? payload.partnerProfiles ?? {}, {}),
    subsystemsByUser: cloneJsonData(snapshot.subsystemsByUser ?? payload.subsystemsByUser ?? {}, {}),
    itemProfiles: cloneJsonData(snapshot.itemProfiles ?? payload.itemProfiles ?? {}, {}),
    locationProfiles: cloneJsonData(snapshot.locationProfiles ?? payload.locationProfiles ?? {}, {}),
    medicationsByUser: cloneJsonData(snapshot.medicationsByUser ?? payload.medicationsByUser ?? {}, {}),
    medicationCheckinsByUser: cloneJsonData(snapshot.medicationCheckinsByUser ?? payload.medicationCheckinsByUser ?? {}, {}),
    journalEntriesByUser: cloneJsonData(snapshot.journalEntriesByUser ?? payload.journalEntriesByUser ?? {}, {}),
    journalShortcutsByUser: cloneJsonData(snapshot.journalShortcutsByUser ?? payload.journalShortcutsByUser ?? {}, {}),
    historyEvents: cloneJsonData(snapshot.historyEvents ?? payload.historyEvents ?? [], []),
    customTemplates: cloneJsonData(snapshot.customTemplates ?? payload.customTemplates ?? {}, {}),
    selectedLightThemeKey: snapshot.selectedLightThemeKey || payload.selectedLightThemeKey || selectedLightThemeKey,
    selectedDarkThemeKey: snapshot.selectedDarkThemeKey || payload.selectedDarkThemeKey || selectedDarkThemeKey,
    customThemeTokens: cloneJsonData(snapshot.customThemeTokens ?? payload.customThemeTokens ?? {}, {}),
    activeUser: snapshot.activeUser || payload.activeUser || getActiveUserName()
  };
}

function importHubDataDump(payload = {}) {
  const normalized = normalizeImportedHubPayload(payload);
  if (!normalized) {
    throw new Error('That file is not a valid ISPD7 JSON export.');
  }

  if (payload.accounts && typeof payload.accounts === 'object' && !Array.isArray(payload.accounts)) {
    Object.entries(payload.accounts).forEach(([key, value]) => {
      if (!key || !value || typeof value !== 'object') return;
      const cleanKey = String(key).trim().toLowerCase();
      const importedAccount = cloneJsonData(value, {});
      if (importedAccount.password === '[redacted]') {
        delete importedAccount.password;
      }
      const normalizedAccount = normalizeRemoteAccount(importedAccount, cleanKey);
      if (!USE_BACKEND_AUTH) {
        const preservedPassword = importedAccount.password || accounts[cleanKey]?.password;
        accounts[cleanKey] = preservedPassword
          ? { ...normalizedAccount, password: preservedPassword }
          : normalizedAccount;
        return;
      }
      accounts[cleanKey] = normalizedAccount;
    });
  }

  if (USE_BACKEND_AUTH && loggedInAccountKey) {
    normalized.ownerAccountKey = loggedInAccountKey;
  } else if (normalized.ownerAccountKey && accounts[normalized.ownerAccountKey]) {
    loggedInAccountKey = normalized.ownerAccountKey;
  }

  applyHubStateSnapshot(normalized, { persistLocal: true });
  persistHubState({ immediate: true, allowDuringInit: true });
  persistAccountState();

  return getHubStateEntityCounts(normalized);
}

function buildPortableExportFileName() {
  return `ispd7-export-${new Date().toISOString().slice(0,10)}.json`;
}

async function exportPortableBackupFile() {
  const dump = buildPortableExportDump();
  const jsonText = JSON.stringify(dump, null, 2);
  const fileName = buildPortableExportFileName();

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'JSON files',
          accept: { 'application/json': ['.json'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(jsonText);
      await writable.close();
      return 'saved';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }

  if (
    typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && typeof File === 'function'
  ) {
    try {
      const shareFile = new File([jsonText], fileName, { type: 'application/json' });
      if (navigator.canShare({ files: [shareFile] })) {
        await navigator.share({
          files: [shareFile],
          title: 'ISPD7 JSON backup'
        });
        return 'shared';
      }
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }

  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1200);
  return 'downloaded';
}

async function pickImportBackupFile() {
  if (typeof window.showOpenFilePicker === 'function') {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{
          description: 'JSON files',
          accept: { 'application/json': ['.json'] }
        }]
      });
      if (!handle) return null;
      const file = await handle.getFile();
      return {
        file,
        text: await file.text()
      };
    } catch (error) {
      if (error?.name === 'AbortError') return null;
    }
  }

  if (!importDataFile) {
    throw new Error('Import is not available in this browser right now.');
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      importDataFile.removeEventListener('change', onChange);
      importDataFile.removeEventListener('cancel', onCancel);
    };

    const onCancel = () => {
      cleanup();
      importDataFile.value = '';
      resolve(null);
    };

    const onChange = async (event) => {
      cleanup();
      const [file] = Array.from(event.target.files || []);
      event.target.value = '';
      if (!file) {
        resolve(null);
        return;
      }
      try {
        resolve({
          file,
          text: await file.text()
        });
      } catch (error) {
        reject(error);
      }
    };

    importDataFile.addEventListener('change', onChange, { once: true });
    importDataFile.addEventListener('cancel', onCancel, { once: true });

    try {
      importDataFile.value = '';
      if (typeof importDataFile.showPicker === 'function') {
        importDataFile.showPicker();
      } else {
        importDataFile.click();
      }
    } catch (_error) {
      cleanup();
      reject(new Error('Your browser blocked the file picker. Try again after refreshing the page.'));
    }
  });
}

if (exportDataBtn) {
  exportDataBtn.addEventListener('click', async () => {
    try {
      const method = await exportPortableBackupFile();
      if (method === 'cancelled') return;
      safeAlert(method === 'shared'
        ? 'Backup ready to share as a JSON file.'
        : 'Backup exported as a JSON file.');
    } catch (error) {
      safeAlert(error?.message || 'Could not export your data right now.');
    }
  });
}

if (importDataBtn) {
  importDataBtn.addEventListener('click', async () => {
    try {
      const picked = await pickImportBackupFile();
      if (!picked) return;

      if (!safeConfirm('Import data from this JSON backup? This will replace the current local hub data in this browser.')) {
        return;
      }

      const parsed = JSON.parse(picked.text);
      const counts = importHubDataDump(parsed);
      navigateTo('dashboard');
      safeAlert(`Import complete. Restored ${counts.total} records, including ${counts.systemCount} systems and ${counts.headmateCount} headmates.`);
    } catch (error) {
      safeAlert(error?.message || 'Could not import that file.');
    }
  });
}

if (clearDataBtn) {
  clearDataBtn.addEventListener('click', () => {
    if (!safeConfirm('Clear ALL local hub data? This cannot be undone and will reset the page.')) return;
    localStorage.clear();
    location.reload();
  });
}

function replaceStoredObject(target, source = {}) {
  Object.keys(target).forEach((key) => delete target[key]);
  Object.entries(source && typeof source === 'object' ? source : {}).forEach(([key, value]) => {
    target[key] = cloneJsonData(value, value);
  });
}

function replaceStoredArray(target, source = []) {
  target.splice(0, target.length, ...cloneJsonData(Array.isArray(source) ? source : [], []));
}

function buildHubStateSnapshot() {
  const snapshot = {
    version: 1,
    ownerAccountKey: loggedInAccountKey || '',
    updatedAt: new Date().toISOString(),
    hubSettings: cloneJsonData(hubSettings, {}),
    privacySettings: cloneJsonData(privacySettings, {}),
    notificationSettings: cloneJsonData(notificationSettings, {}),
    terminologySettings: cloneJsonData(terminologySettings, {}),
    moduleVisibilitySettings: cloneJsonData(moduleVisibilitySettings, {}),
    systemProfiles: cloneJsonData(systemProfiles, {}),
    headmateProfilesByUser: cloneJsonData(headmateProfilesByUser, {}),
    headmateFoldersByUser: cloneJsonData(headmateFoldersByUser, {}),
    chatMessagesByUser: cloneJsonData(chatMessagesByUser, {}),
    directMessagesByAccount: cloneJsonData(directMessagesByAccount, {}),
    partnerProfiles: cloneJsonData(partnerProfiles, {}),
    subsystemsByUser: cloneJsonData(subsystemsByUser, {}),
    itemProfiles: cloneJsonData(itemProfiles, {}),
    locationProfiles: cloneJsonData(locationProfiles, {}),
    medicationsByUser: cloneJsonData(medicationsByUser, {}),
    medicationCheckinsByUser: cloneJsonData(medicationCheckinsByUser, {}),
    journalEntriesByUser: cloneJsonData(journalEntriesByUser, {}),
    journalShortcutsByUser: cloneJsonData(journalShortcutsByUser, {}),
    historyEvents: cloneJsonData(historyEvents, []),
    customTemplates: cloneJsonData(customTemplates, {}),
    selectedLightThemeKey,
    selectedDarkThemeKey,
    customThemeTokens: cloneJsonData(customThemeTokens, {}),
    activeUser: getActiveUserName()
  };

  return cloneForStorage(snapshot);
}

function getHubStateEntityCounts(snapshot = {}) {
  const systemCount = Object.keys(snapshot?.systemProfiles || {}).length;
  const headmateCount = Object.values(snapshot?.headmateProfilesByUser || {}).reduce((sum, profiles) => {
    return sum + Object.keys(profiles || {}).length;
  }, 0);
  const partnerCount = Object.keys(snapshot?.partnerProfiles || {}).length;
  const subsystemCount = Object.values(snapshot?.subsystemsByUser || {}).reduce((sum, profiles) => {
    return sum + Object.keys(profiles || {}).length;
  }, 0);
  const itemCount = Object.keys(snapshot?.itemProfiles || {}).length;
  const locationCount = Object.keys(snapshot?.locationProfiles || {}).length;
  const journalCount = Object.values(snapshot?.journalEntriesByUser || {}).reduce((sum, entries) => {
    return sum + (Array.isArray(entries) ? entries.length : 0);
  }, 0);

  return {
    systemCount,
    headmateCount,
    partnerCount,
    subsystemCount,
    itemCount,
    locationCount,
    journalCount,
    total: systemCount + headmateCount + partnerCount + subsystemCount + itemCount + locationCount + journalCount
  };
}

function applyHubStateSnapshot(saved = {}, options = {}) {
  if (!saved || typeof saved !== 'object') return false;

  Object.assign(hubSettings, saved.hubSettings || {});
  Object.assign(privacySettings, saved.privacySettings || {});
  Object.assign(notificationSettings, saved.notificationSettings || {});
  Object.assign(terminologySettings, saved.terminologySettings || {});
  Object.assign(moduleVisibilitySettings, MODULE_VISIBILITY_DEFAULTS, saved.moduleVisibilitySettings || {});

  if (saved.customThemeTokens?.light && typeof saved.customThemeTokens.light === 'object') {
    customThemeTokens.light = { ...customThemeTokens.light, ...saved.customThemeTokens.light };
  }
  if (saved.customThemeTokens?.dark && typeof saved.customThemeTokens.dark === 'object') {
    customThemeTokens.dark = { ...customThemeTokens.dark, ...saved.customThemeTokens.dark };
  }
  if (saved.selectedLightThemeKey && Object.prototype.hasOwnProperty.call(LIGHT_THEME_PRESETS, saved.selectedLightThemeKey)) {
    selectedLightThemeKey = saved.selectedLightThemeKey;
  }
  if (saved.selectedDarkThemeKey && Object.prototype.hasOwnProperty.call(DARK_THEME_PRESETS, saved.selectedDarkThemeKey)) {
    selectedDarkThemeKey = saved.selectedDarkThemeKey;
  }

  replaceStoredObject(systemProfiles, saved.systemProfiles);
  replaceStoredObject(headmateProfilesByUser, saved.headmateProfilesByUser);
  replaceStoredObject(headmateFoldersByUser, saved.headmateFoldersByUser);
  replaceStoredObject(chatMessagesByUser, saved.chatMessagesByUser);
  replaceStoredObject(directMessagesByAccount, saved.directMessagesByAccount);
  replaceStoredObject(partnerProfiles, saved.partnerProfiles);
  replaceStoredObject(subsystemsByUser, saved.subsystemsByUser);
  replaceStoredObject(itemProfiles, saved.itemProfiles);
  replaceStoredObject(locationProfiles, saved.locationProfiles);
  replaceStoredObject(medicationsByUser, saved.medicationsByUser);
  replaceStoredObject(medicationCheckinsByUser, saved.medicationCheckinsByUser);
  replaceStoredObject(journalEntriesByUser, saved.journalEntriesByUser);
  replaceStoredObject(journalShortcutsByUser, saved.journalShortcutsByUser);
  replaceStoredObject(customTemplates, saved.customTemplates);
  replaceStoredArray(historyEvents, saved.historyEvents);

  if (hubNameInput) hubNameInput.value = hubSettings.name || 'System Hub';
  if (hubDescInput) hubDescInput.value = hubSettings.description || '';
  if (hubIconInput) hubIconInput.value = hubSettings.icon || '';
  if (lightThemeSelect) lightThemeSelect.value = selectedLightThemeKey;
  if (darkThemeSelect) darkThemeSelect.value = selectedDarkThemeKey;

  moduleVisibilityToggleIds.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(moduleVisibilitySettings[key]);
  });
  privacyToggleIds.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(privacySettings[key]);
  });
  notifToggleIds.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(notificationSettings[key]);
  });

  applyHubInfo();
  applyTerminology();
  applyThemeSelection();
  applyModuleVisibilitySettings();
  rebuildUserDropdownOptions(saved.activeUser || '');

  if (typeof renderSystemProfiles === 'function') renderSystemProfiles();
  if (typeof renderHeadmatesTable === 'function') renderHeadmatesTable();
  if (typeof renderChatSidebar === 'function') renderChatSidebar();
  if (typeof renderPartnersTable === 'function') renderPartnersTable();
  if (typeof renderSubsystemsGrid === 'function') renderSubsystemsGrid();
  if (typeof renderItemsTable === 'function') renderItemsTable(itemsSearch?.value || '');
  if (typeof renderLocationsTable === 'function') renderLocationsTable(locationsSearch?.value || '');
  if (typeof renderTemplatesTable === 'function') renderTemplatesTable(templatesSearch?.value || '');
  if (typeof renderMedicationTracker === 'function') renderMedicationTracker();
  if (typeof renderJournalModule === 'function') renderJournalModule();
  if (typeof renderHistoryTimeline === 'function') renderHistoryTimeline();
  if (typeof renderAccountModule === 'function') renderAccountModule();
  if (typeof renderDashboard === 'function') renderDashboard();

  if (options.persistLocal) {
    try {
      writeStoredJsonWithBackup(HUB_STATE_STORAGE_KEY, HUB_STATE_BACKUP_KEY, buildHubStateSnapshot(), {
        maxBytes: MAX_SAFE_LOCAL_STATE_BYTES,
        warningMessage: 'Uploaded media made the browser cache too large, so a compact backup was saved to stop data wipes. Use smaller images or image URLs for the most reliable persistence.'
      });
    } catch (_err) {
      // Ignore local backup errors.
    }
  }

  return true;
}

function persistHubState(options = {}) {
  const dump = buildHubStateSnapshot();
  const serialized = JSON.stringify(dump);
  const accountPayload = buildRemoteAccountStatePayload();
  const serializedAccount = JSON.stringify(accountPayload || {});

  let storedSnapshot = null;
  try {
    storedSnapshot = readStoredJsonWithBackup(HUB_STATE_STORAGE_KEY, HUB_STATE_BACKUP_KEY, null);
  } catch (_err) {
    storedSnapshot = null;
  }

  const dumpCounts = getHubStateEntityCounts(dump);
  const storedCounts = storedSnapshot ? getHubStateEntityCounts(storedSnapshot) : { total: 0 };
  const dumpOwner = normalizeLookupName(dump.ownerAccountKey || '');
  const storedOwner = normalizeLookupName(storedSnapshot?.ownerAccountKey || '');
  const ownersComparable = !storedOwner || !dumpOwner || storedOwner === dumpOwner;
  const shouldPreserveStoredLocal = ownersComparable
    && storedCounts.total > 0
    && (
      dumpCounts.total === 0
      || (storedCounts.total > dumpCounts.total && (!isSignedIn() || initialSessionSyncPending))
    );

  const localSnapshotToKeep = shouldPreserveStoredLocal && storedSnapshot ? storedSnapshot : dump;
  const serializedLocalSnapshot = shouldPreserveStoredLocal && storedSnapshot ? JSON.stringify(storedSnapshot) : serialized;

  writeStoredJsonWithBackup(HUB_STATE_STORAGE_KEY, HUB_STATE_BACKUP_KEY, localSnapshotToKeep, {
    maxBytes: MAX_SAFE_LOCAL_STATE_BYTES,
    warningMessage: 'Uploaded media made the browser cache too large, so a compact backup was saved to stop data wipes. Use smaller images or image URLs for the most reliable persistence.'
  });

  if (estimateStringBytes(serializedLocalSnapshot) > MAX_SAFE_LOCAL_STATE_BYTES) {
    showStorageWarning('Your saved data is getting too large for reliable browser storage. Smaller uploads or pasted image URLs will keep it from being wiped.');
  }

  if (options.remote === false || !USE_BACKEND_AUTH || !authToken || !loggedInAccountKey) {
    return localSnapshotToKeep;
  }

  if (initialSessionSyncPending && !options.allowDuringInit) {
    return localSnapshotToKeep;
  }

  const remoteBaseSnapshot = shouldPreserveStoredLocal && storedSnapshot ? storedSnapshot : dump;
  const remoteSerialized = shouldPreserveStoredLocal && storedSnapshot ? JSON.stringify(storedSnapshot) : serialized;
  const preferredRemoteState = estimateStringBytes(remoteSerialized) <= MAX_SAFE_REMOTE_STATE_BYTES
    ? { value: remoteBaseSnapshot, serialized: remoteSerialized, compacted: false }
    : buildStorageSafeClone(remoteBaseSnapshot, MAX_SAFE_REMOTE_STATE_BYTES, { stripAllEmbeddedMedia: true });

  if (preferredRemoteState.serialized === lastRemoteHubStateText && serializedAccount === lastRemoteAccountStateText) {
    return localSnapshotToKeep;
  }

  const flushRemoteState = async () => {
    try {
      let result;
      try {
        result = await apiRequest('/api/me/state', {
          method: 'PUT',
          keepalive: Boolean(options.immediate && estimateStringBytes(preferredRemoteState.serialized) < 60 * 1024),
          body: JSON.stringify({
            hubState: preferredRemoteState.value,
            account: accountPayload || undefined
          })
        });
      } catch (err) {
        const shouldRetryCompact = !preferredRemoteState.compacted && (err?.status === 413 || /too large/i.test(String(err?.message || '')));
        if (!shouldRetryCompact) throw err;

        const compactRemoteState = buildStorageSafeClone(remoteBaseSnapshot, MAX_SAFE_REMOTE_STATE_BYTES, { stripAllEmbeddedMedia: true });
        result = await apiRequest('/api/me/state', {
          method: 'PUT',
          keepalive: Boolean(options.immediate && estimateStringBytes(JSON.stringify(compactRemoteState.value)) < 60 * 1024),
          body: JSON.stringify({
            hubState: compactRemoteState.value,
            account: accountPayload || undefined
          })
        });
      }

      if (result?.compacted) {
        showStorageWarning('The latest upload-heavy save was compacted so the rest of your data would not wipe. Use smaller images or image URLs to keep every upload across refreshes.');
      }

      if (result?.account) {
        const savedAccount = normalizeRemoteAccount(result.account, loggedInAccountKey);
        accounts[savedAccount.username] = savedAccount;
        loggedInAccountKey = savedAccount.username;
        persistAccountState();
        lastRemoteAccountStateText = JSON.stringify(buildRemoteAccountStatePayload(savedAccount) || {});
      } else {
        lastRemoteAccountStateText = serializedAccount;
      }
      lastRemoteHubStateText = JSON.stringify(result?.hubState || preferredRemoteState.value);
    } catch (err) {
      showStorageWarning(err?.message || 'The latest save could not reach the backend.');
    }
  };

  if (remoteHubStateSaveTimer) window.clearTimeout(remoteHubStateSaveTimer);
  if (options.immediate) {
    void flushRemoteState();
  } else {
    remoteHubStateSaveTimer = window.setTimeout(() => {
      void flushRemoteState();
    }, 850);
  }

  return localSnapshotToKeep;
}

function loadHubState() {
  try {
    const saved = readStoredJsonWithBackup(HUB_STATE_STORAGE_KEY, HUB_STATE_BACKUP_KEY, null);
    if (!saved || typeof saved !== 'object') return;

    if (USE_BACKEND_AUTH) {
      const snapshotOwner = normalizeLookupName(saved.ownerAccountKey || '');
      const activeOwner = normalizeLookupName(loggedInAccountKey || '');
      if (snapshotOwner && activeOwner && snapshotOwner !== activeOwner) return;
    }

    applyHubStateSnapshot(saved);
  } catch (_err) {
    // Ignore malformed saved data and keep defaults.
  }
}

async function syncSessionFromBackend() {
  if (!USE_BACKEND_AUTH || !authToken) {
    initialSessionSyncPending = false;
    return;
  }

  initialSessionSyncPending = true;

  try {
    const result = await apiRequest('/api/me');
    const remoteAccount = normalizeRemoteAccount(result.account, loggedInAccountKey || 'user');
    if (loggedInAccountKey && loggedInAccountKey !== remoteAccount.username) {
      delete accounts[loggedInAccountKey];
    }
    accounts[remoteAccount.username] = remoteAccount;
    loggedInAccountKey = remoteAccount.username;
    lastRemoteAccountStateText = JSON.stringify(buildRemoteAccountStatePayload(remoteAccount) || {});
    persistAccountState();

    const syncPreference = resolveHubStateSyncPreference(remoteAccount, {
      allowOwnerlessLocal: true
    });

    if (syncPreference.remoteSnapshot && !syncPreference.shouldUseLocalSnapshot && !syncPreference.shouldProtectLocalFromEmptyRemote) {
      applyHubStateSnapshot(syncPreference.remoteSnapshot, { persistLocal: true });
      lastRemoteHubStateText = JSON.stringify(syncPreference.remoteSnapshot);
    } else if ((syncPreference.shouldUseLocalSnapshot || syncPreference.shouldProtectLocalFromEmptyRemote) && syncPreference.localSnapshot) {
      applyHubStateSnapshot(syncPreference.localSnapshot, { persistLocal: true });
      const savedSnapshot = persistHubState({ immediate: true, allowDuringInit: true });
      lastRemoteHubStateText = JSON.stringify(savedSnapshot || syncPreference.localSnapshot || {});
    }

    await refreshAccountDirectoryFromBackend();
    renderAccountModule();
  } catch (_err) {
    // Keep the last local session if the backend is temporarily unavailable.
  } finally {
    initialSessionSyncPending = false;
  }
}

let persistHubStateTimer = null;
function scheduleHubStatePersist() {
  if (persistHubStateTimer) window.clearTimeout(persistHubStateTimer);
  persistHubStateTimer = window.setTimeout(() => {
    persistHubState();
    persistAccountState();
  }, 650);
}

['click', 'change', 'input'].forEach((eventName) => {
  document.addEventListener(eventName, () => {
    scheduleHubStatePersist();
  }, true);
});

window.addEventListener('pagehide', () => {
  persistHubState({ immediate: true, allowDuringInit: true });
  persistAccountState();
});

window.addEventListener('beforeunload', () => {
  persistHubState({ immediate: true, allowDuringInit: true });
  persistAccountState();
});

window.addEventListener('focus', () => {
  if (USE_BACKEND_AUTH && authToken && loggedInAccountKey) {
    void syncSessionFromBackend();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && USE_BACKEND_AUTH && authToken && loggedInAccountKey) {
    void syncSessionFromBackend();
  }
});

window.setInterval(() => {
  if (!document.hidden && USE_BACKEND_AUTH && authToken && loggedInAccountKey) {
    void syncSessionFromBackend();
  }
}, 45000);

loadHubState();
applyTerminology();
applyThemeSelection();
applyModuleVisibilitySettings();
syncSessionFromBackend();

if (systemEditColor) {
  syncColorValuePill(systemEditColor);
  systemEditColor.addEventListener('input', () => {
    syncColorValuePill(systemEditColor);
  });
  systemEditColor.addEventListener('change', () => {
    syncColorValuePill(systemEditColor);
  });
}
if (editAccountColorInput) {
  syncColorValuePill(editAccountColorInput, '#6c63ff');
  editAccountColorInput.addEventListener('input', () => {
    syncColorValuePill(editAccountColorInput, '#6c63ff');
  });
  editAccountColorInput.addEventListener('change', () => {
    syncColorValuePill(editAccountColorInput, '#6c63ff');
  });
}

enhanceMediaPickerInput(systemEditPhoto, { kind: 'photo' });
enhanceMediaPickerInput(systemEditBanner, { kind: 'banner' });
enhanceMediaPickerInput(editAccountPhotoInput, { kind: 'photo' });
enhanceMediaPickerInput(editAccountBannerInput, { kind: 'banner' });
bindAutoGrowingTextareas(document);