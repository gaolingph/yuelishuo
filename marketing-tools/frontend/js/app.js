/**
 * 乐说邦客户服务系统 v2.0 — 前端 SPA
 * 英语单词速记 · 3天背完3年单词
 * 特性：手机验证码登录 · 多校区隔离 · 角色权限 · 操作留痕 · 佣金管理
 */
const API_BASE = window.location.origin;

/* ═══════════════════════════════════════
   简版 DOM 工具
   ═══════════════════════════════════════ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ═══════════════════════════════════════
   认证状态管理
   ═══════════════════════════════════════ */
let authToken = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let currentCampus = JSON.parse(localStorage.getItem('campus') || 'null');

function isLoggedIn() { return !!authToken && !!currentUser; }

function saveAuth(token, user, campus) {
    authToken = token;
    currentUser = user;
    currentCampus = campus;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('campus', JSON.stringify(campus));
}

function clearAuth() {
    authToken = null;
    currentUser = null;
    currentCampus = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('campus');
}

function hasRole(...roles) {
    return currentUser && roles.includes(currentUser.role);
}

function getRoleLabel(role) {
    const map = {
        'super_admin': '超级管理员',
        'campus_admin': '校区管理员',
        'principal': '校长',
        'staff': '员工',
    };
    return map[role] || role;
}

/* ═══════════════════════════════════════
   API 封装（自动带 Bearer Token）
   ═══════════════════════════════════════ */
async function apiFetch(path, options = {}) {
    const headers = options.headers || {};
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const resp = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (resp.status === 401) {
        showToast('登录已过期，请重新登录', 'error');
        clearAuth();
        showLogin();
        throw new Error('未登录');
    }

    if (!resp.ok) {
        let msg;
        try {
            const err = await resp.json();
            msg = err.detail || `请求失败 (${resp.status})`;
        } catch {
            msg = `请求失败 (${resp.status})`;
        }
        throw new Error(msg);
    }

    return resp.json();
}

function apiGet(path) {
    return apiFetch(path, { method: 'GET' });
}

function apiPost(path, data) {
    return apiFetch(path, {
        method: 'POST',
        body: data !== undefined ? JSON.stringify(data) : undefined,
    });
}

function apiPut(path, data) {
    return apiFetch(path, {
        method: 'PUT',
        body: data !== undefined ? JSON.stringify(data) : undefined,
    });
}

function apiDelete(path) {
    return apiFetch(path, { method: 'DELETE' });
}

/* ═══════════════════════════════════════
   Toast 通知
   ═══════════════════════════════════════ */
function showToast(message, type = 'info') {
    const container = $('.toast-container') || (() => {
        const div = document.createElement('div');
        div.className = 'toast-container';
        document.body.appendChild(div);
        return div;
    })();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

/* ═══════════════════════════════════════
   Loader
   ═══════════════════════════════════════ */
function showLoader(show = true) {
    const loader = $('#pageLoader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

/* ═══════════════════════════════════════
   模态框
   ═══════════════════════════════════════ */
function openModal(title, html) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modalOverlay').style.display = 'flex';
    // 让所有模态框内的表单 submit 不导致页面刷新
    $$('#modalBody form').forEach(f => {
        if (!f.dataset.bound) {
            f.addEventListener('submit', e => e.preventDefault());
            f.dataset.bound = '1';
        }
    });
}

function closeModal() {
    $('#modalOverlay').style.display = 'none';
}

$('#modalOverlay')?.addEventListener('click', (e) => {
    if (e.target === $('#modalOverlay')) closeModal();
});
$('#modalCloseBtn')?.addEventListener('click', closeModal);

/* ═══════════════════════════════════════
   状态标签工具
   ═══════════════════════════════════════ */
const STATUS_MAP = {
    'new': '新线索',
    'first_contact': '已联系',
    'interested': '有意向',
    'trial_set': '已安排试听',
    'trial_done': '已试听',
    'negotiating': '报价中',
    'converted': '已成交',
    'lost': '已流失',
    'not_contacted': '无法联系'
};

function renderStatusTag(status) {
    const label = STATUS_MAP[status] || status;
    return `<span class="tag tag-${status}">${label}</span>`;
}

function renderSchoolTypeTag(type) {
    const map = {
        'primary': '小学', 'junior': '初中', 'senior': '高中',
        'nine_year': '九年制', 'kindergarten': '幼儿园', 'other': '其他'
    };
    return `<span class="tag ${type}">${map[type] || type}</span>`;
}

function renderRoleTag(role) {
    const map = {
        'parent': '家长', 'teacher': '老师', 'principal': '校长', 'other': '其他'
    };
    const label = map[role] || role || '未知';
    return `<span class="tag tag-${role}">${label}</span>`;
}

function renderPagination(page, total, pageSize, callback) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (totalPages <= 1) return '';
    return `
        <div class="pagination">
            <button onclick="(${callback})(${page - 1})" ${page <= 1 ? 'disabled' : ''}>上一页</button>
            <span class="page-info">第 ${page}/${totalPages} 页（共 ${total} 条）</span>
            <button onclick="(${callback})(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
        </div>
    `;
}

function formatDate(d) {
    if (!d) return '-';
    try {
        return new Date(d).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return '-'; }
}

function formatDateShort(d) {
    if (!d) return '-';
    try {
        return new Date(d).toLocaleDateString('zh-CN');
    } catch { return '-'; }
}

function formatMoney(amount) {
    if (amount === null || amount === undefined) return '¥0.00';
    return '¥' + parseFloat(amount).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/* ═══════════════════════════════════════
   登录 / 退出
   ═══════════════════════════════════════ */
function showLogin() {
    $('#loginPage').style.display = 'flex';
    $('#appLayout').style.display = 'none';
    window.location.hash = '';
}

function showApp() {
    $('#loginPage').style.display = 'none';
    $('#appLayout').style.display = 'flex';
}

async function login(phone, code) {
    const resp = await apiPost('/api/auth/login', { phone, code });
    saveAuth(resp.token, resp.user, resp.campus);
    showApp();
    renderSidebar();
    navigate('dashboard');
    showToast(`欢迎，${resp.user.display_name || resp.user.phone}！`, 'success');
}

function logout() {
    clearAuth();
    showLogin();
    showToast('已退出登录', 'info');
}

/* ═══════════════════════════════════════
   侧边栏渲染
   ═══════════════════════════════════════ */
const NAV_ITEMS = {
    super_admin: [
        { page: 'dashboard', icon: '📊', label: '数据看板' },
        { page: 'leads', icon: '👥', label: '线索管理', badge: 'leadCount' },
        { page: 'schools', icon: '🏫', label: '学校名录' },
        { page: 'deals', icon: '💰', label: '成交管理' },
        { page: 'commission', icon: '🏆', label: '佣金管理' },
        { page: 'social', icon: '🔍', label: '自媒体拓客' },
        { page: 'campus', icon: '🏢', label: '校区管理' },
        { page: 'staff', icon: '👤', label: '员工管理' },
        { page: 'audit', icon: '📋', label: '操作留痕' },
        { page: 'stats', icon: '📈', label: '统计分析' },
    ],
    campus_admin: [
        { page: 'dashboard', icon: '📊', label: '数据看板' },
        { page: 'leads', icon: '👥', label: '线索管理', badge: 'leadCount' },
        { page: 'schools', icon: '🏫', label: '学校名录' },
        { page: 'deals', icon: '💰', label: '成交管理' },
        { page: 'commission', icon: '🏆', label: '佣金管理' },
        { page: 'social', icon: '🔍', label: '自媒体拓客' },
        { page: 'staff', icon: '👤', label: '员工管理' },
        { page: 'audit', icon: '📋', label: '操作留痕' },
        { page: 'stats', icon: '📈', label: '统计分析' },
    ],
    principal: [
        { page: 'dashboard', icon: '📊', label: '数据看板' },
        { page: 'leads', icon: '👥', label: '线索管理', badge: 'leadCount' },
        { page: 'schools', icon: '🏫', label: '学校名录' },
        { page: 'deals', icon: '💰', label: '成交管理' },
        { page: 'commission', icon: '🏆', label: '佣金管理' },
        { page: 'social', icon: '🔍', label: '自媒体拓客' },
        { page: 'staff', icon: '👤', label: '员工管理' },
        { page: 'audit', icon: '📋', label: '操作留痕' },
        { page: 'stats', icon: '📈', label: '统计分析' },
    ],
    staff: [
        { page: 'dashboard', icon: '📊', label: '数据看板' },
        { page: 'leads', icon: '👥', label: '线索管理', badge: 'leadCount' },
        { page: 'schools', icon: '🏫', label: '学校名录' },
        { page: 'deals', icon: '💰', label: '我的成交' },
        { page: 'commission', icon: '🏆', label: '我的佣金' },
        { page: 'social', icon: '🔍', label: '自媒体拓客' },
    ],
};

function renderSidebar() {
    const navList = $('#navList');
    const footer = $('#sidebarFooter');
    const campusLabel = $('#sidebarCampus');

    // 校区名称
    if (currentCampus) {
        campusLabel.textContent = currentCampus.name + ' · ' + getRoleLabel(currentUser.role);
    } else {
        campusLabel.textContent = getRoleLabel(currentUser.role);
    }

    // 导航项
    const role = currentUser.role;
    const items = NAV_ITEMS[role] || NAV_ITEMS.staff;
    navList.innerHTML = items.map(item => `
        <li>
            <a class="nav-item" data-page="${item.page}">
                <span class="nav-icon">${item.icon}</span>
                <span class="nav-label">${item.label}</span>
                ${item.badge ? `<span class="nav-badge" id="${item.badge}Badge">0</span>` : ''}
            </a>
        </li>
    `).join('');

    // 导航点击
    $$('.nav-item').forEach(el => {
        el.addEventListener('click', () => {
            const page = el.dataset.page;
            location.hash = page;
            navigate(page);
            closeMobileSidebar();
        });
    });

    // 底部用户信息
    const avatarChar = (currentUser.display_name || currentUser.phone)[0];
    footer.innerHTML = `
        <div class="sidebar-user">
            <div class="sidebar-avatar">${avatarChar}</div>
            <div class="sidebar-user-info">
                <div class="sidebar-user-name">${currentUser.display_name || currentUser.phone}</div>
                <div class="sidebar-user-role">${getRoleLabel(currentUser.role)}</div>
            </div>
        </div>
        <a class="sidebar-logout" id="logoutBtn">🚪 退出登录</a>
    `;

    $('#logoutBtn')?.addEventListener('click', logout);
}

/* ═══════════════════════════════════════
   移动端汉堡菜单
   ═══════════════════════════════════════ */
function openMobileSidebar() {
    $('#sidebar').classList.add('open');
    $('#sidebarOverlay').classList.add('active');
    $('#hamburgerBtn').classList.add('active');
}

function closeMobileSidebar() {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('active');
    $('#hamburgerBtn').classList.remove('active');
}

$('#hamburgerBtn')?.addEventListener('click', () => {
    if ($('#sidebar').classList.contains('open')) {
        closeMobileSidebar();
    } else {
        openMobileSidebar();
    }
});

$('#sidebarOverlay')?.addEventListener('click', closeMobileSidebar);

/* ═══════════════════════════════════════
   导航系统
   ═══════════════════════════════════════ */
let currentPage = 'dashboard';

function navigate(page) {
    // 未登录跳转
    if (!isLoggedIn()) {
        showLogin();
        return;
    }

    currentPage = page;

    // 更新导航高亮
    $$('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });

    renderPage(page);
}

window.addEventListener('hashchange', () => {
    const page = location.hash.slice(1) || 'dashboard';
    navigate(page);
});

/* ═══════════════════════════════════════
   页面渲染引擎
   ═══════════════════════════════════════ */
async function renderPage(page) {
    const container = $('#mainContent');
    showLoader(true);
    try {
        switch (page) {
            case 'dashboard': await renderDashboard(container); break;
            case 'leads': await renderLeads(container); break;
            case 'schools': await renderSchools(container); break;
            case 'stats': await renderStats(container); break;
            case 'campus': await renderCampus(container); break;
            case 'staff': await renderStaff(container); break;
            case 'deals': await renderDeals(container); break;
            case 'commission': await renderCommission(container); break;
            case 'social': await renderSocial(container); break;
            case 'audit': await renderAudit(container); break;
            default: await renderDashboard(container);
        }
    } catch (err) {
        console.error('Render error:', err);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>加载失败：${err.message}</p>
                <button class="btn btn-primary mt-4" onclick="location.reload()">重新加载</button>
            </div>
        `;
    } finally {
        showLoader(false);
    }
}

/* ═══════════════════════════════════════
   ═════════════════════════════════════════
   页面渲染函数
   ═════════════════════════════════════════
   ═══════════════════════════════════════ */

// ═══════════════════════════════════════
// 数据看板 (Dashboard)
// ═══════════════════════════════════════
async function renderDashboard(container) {
    const overview = await apiGet('/api/stats/overview');
    const pipeline = await apiGet('/api/leads/stats/pipeline');
    const trend = await apiGet('/api/stats/weekly-trend');

    const today = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>📊 数据看板</h2>
                <p>${today} · 系统概览</p>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="navigate('leads')">管理线索</button>
                <button class="btn btn-success" onclick="navigate('deals')">成交管理</button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${overview.total_leads}</div>
                <div class="stat-label">总线索数</div>
            </div>
            <div class="stat-card info">
                <div class="stat-value">${overview.new_leads}</div>
                <div class="stat-label">待跟进</div>
            </div>
            <div class="stat-card success">
                <div class="stat-value">${overview.converted}</div>
                <div class="stat-label">已成交</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-value">${overview.conversion_rate}%</div>
                <div class="stat-label">转化率</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${overview.total_deals || 0}</div>
                <div class="stat-label">成交单数</div>
            </div>
            <div class="stat-card info">
                <div class="stat-value">¥${(overview.total_revenue || 0).toLocaleString()}</div>
                <div class="stat-label">总营收</div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><h3>跟进管道</h3></div>
            <div class="pipeline-bars">
                ${['new', 'first_contact', 'interested', 'trial_set', 'trial_done', 'negotiating', 'converted', 'lost'].map(key => {
                    const count = pipeline[key] || 0;
                    const maxVal = Math.max(...Object.values(pipeline), 1);
                    const pct = (count / maxVal * 100).toFixed(0);
                    const label = STATUS_MAP[key] || key;
                    return `
                        <div style="margin-bottom:10px;">
                            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                                <span>${label}</span>
                                <span>${count}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="fill" style="width:${pct}%;background:${key === 'converted' ? 'var(--success)' : key === 'lost' ? 'var(--danger)' : 'var(--primary)'}"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <div class="card">
            <div class="card-header"><h3>近30天新增趋势</h3></div>
            <div id="trendChart" style="height:180px;display:flex;align-items:flex-end;gap:2px;padding:16px 0;">
                ${Object.entries(trend).length > 0 ? (() => {
                    const vals = Object.values(trend);
                    const maxVal = Math.max(...vals, 1);
                    return Object.entries(trend).map(([date, count]) => {
                        const h = (count / maxVal * 160).toFixed(0);
                        const shortDate = date.slice(5);
                        return `<div title="${date}: ${count}" style="flex:1;display:flex;flex-direction:column;align-items:center;">
                            <div style="width:100%;background:var(--primary);border-radius:3px 3px 0 0;height:${h}px;min-height:2px;opacity:0.8;"></div>
                            <span style="font-size:9px;color:var(--gray-400);margin-top:4px;writing-mode:vertical-lr;">${shortDate}</span>
                        </div>`;
                    }).join('');
                })() : '<div style="text-align:center;width:100%;color:var(--gray-400);">暂无数据</div>'}
            </div>
        </div>
    `;

    // 更新侧边栏计数
    const badge = $('#leadCountBadge');
    if (badge) badge.textContent = overview.total_leads;
}

// ═══════════════════════════════════════
// 线索管理 (Leads)
// ═══════════════════════════════════════
let leadsPageState = { page: 1, keyword: '', status: '', pageSize: 20 };

async function renderLeads(container, state = leadsPageState) {
    Object.assign(leadsPageState, state);
    const { page, keyword, status } = leadsPageState;
    const params = new URLSearchParams({ page, page_size: 20 });
    if (keyword) params.set('keyword', keyword);
    if (status) params.set('status', status);
    const data = await apiGet(`/api/leads?${params}`);

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>👥 线索管理</h2>
                <p>管理所有客户线索 · 共 ${data.total} 条</p>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="showCreateLead()">+ 新增线索</button>
                <button class="btn btn-ghost" onclick="showImportLeads()">📥 批量导入</button>
            </div>
        </div>

        <div class="card">
            <div class="search-bar">
                <input type="text" id="leadSearch" placeholder="搜索姓名/电话/学校..." value="${keyword}"
                       onkeyup="if(event.key==='Enter')leadSearch()">
                <select id="leadStatusFilter" onchange="leadSearch()">
                    <option value="">全部状态</option>
                    ${Object.entries(STATUS_MAP).map(([k, v]) =>
                        `<option value="${k}" ${k === status ? 'selected' : ''}>${v}</option>`
                    ).join('')}
                </select>
                <button class="btn btn-primary" onclick="leadSearch()">🔍 搜索</button>
                <button class="btn btn-ghost" onclick="leadSearch(true)">🔄 重置</button>
            </div>

            <div class="table-container mobile-cards">
                <table>
                    <thead>
                        <tr>
                            <th>姓名</th>
                            <th>电话</th>
                            <th>学校</th>
                            <th>状态</th>
                            <th>来源</th>
                            <th>负责人</th>
                            <th>跟进</th>
                            <th>更新时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.length === 0 ? `
                            <tr><td colspan="9" class="text-center" style="padding:40px;color:var(--gray-400);">暂无线索数据</td></tr>
                        ` : data.items.map(lead => `
                            <tr>
                                <td data-label="姓名"><strong>${lead.name || '-'}</strong></td>
                                <td data-label="电话">${lead.phone || '-'}</td>
                                <td data-label="学校" class="truncate" title="${lead.school_name || ''}">${lead.school_name || '-'}</td>
                                <td data-label="状态">${renderStatusTag(lead.status)}</td>
                                <td data-label="来源">${lead.source || '-'}</td>
                                <td data-label="负责人">${lead.owner || '-'}</td>
                                <td data-label="跟进">${lead.interaction_count || 0}次</td>
                                <td data-label="更新时间">${formatDateShort(lead.updated_at)}</td>
                                <td data-label="操作">
                                    <button class="btn btn-sm btn-ghost" onclick="showLeadDetail(${lead.id})">详情</button>
                                    <button class="btn btn-sm btn-ghost" onclick="editLead(${lead.id})">编辑</button>
                                    ${hasRole('super_admin', 'campus_admin') ? `
                                        <button class="btn btn-sm btn-success" onclick="showCreateDeal(${lead.id})">成交</button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            ${renderPagination(page, data.total, leadsPageState.pageSize, 'renderLeadsPage')}
        </div>
    `;
}

window.renderLeadsPage = (page) => renderLeads($('#mainContent'), { ...leadsPageState, page });
window.leadSearch = (reset = false) => {
    const keyword = reset ? '' : $('#leadSearch')?.value || '';
    const status = reset ? '' : $('#leadStatusFilter')?.value || '';
    renderLeads($('#mainContent'), { page: 1, keyword, status });
};

// ── 创建线索 ──
window.showCreateLead = () => {
    openModal('新增线索', `
        <form id="createLeadForm">
            <div class="form-row">
                <div class="form-group">
                    <label>联系人姓名</label>
                    <input name="name" placeholder="如：王老师">
                </div>
                <div class="form-group">
                    <label>联系电话 *</label>
                    <input name="phone" placeholder="手机号" type="tel">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>微信号</label>
                    <input name="wechat" placeholder="微信号">
                </div>
                <div class="form-group">
                    <label>角色</label>
                    <select name="role">
                        <option value="parent">家长</option>
                        <option value="teacher">老师</option>
                        <option value="principal">校长</option>
                        <option value="other">其他</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>学校名称</label>
                    <input name="school_name" placeholder="如：育才中学">
                </div>
                <div class="form-group">
                    <label>年级</label>
                    <input name="grade" placeholder="如：三年级">
                </div>
            </div>
            <div class="form-group">
                <label>跟进状态</label>
                <select name="status">
                    ${Object.entries(STATUS_MAP).map(([k, v]) =>
                        `<option value="${k}" ${k === 'new' ? 'selected' : ''}>${v}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" rows="3" placeholder="其他信息..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">保存线索</button>
        </form>
    `);

    $('#createLeadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            await apiPost('/api/leads', data);
            showToast('线索创建成功！', 'success');
            closeModal();
            renderLeads($('#mainContent'));
        } catch (err) {
            showToast('创建失败：' + err.message, 'error');
        }
    });
};

// ── 线索详情 ──
window.showLeadDetail = async (leadId) => {
    const [lead, interactions] = await Promise.all([
        apiGet(`/api/leads/${leadId}`),
        apiGet(`/api/interactions/lead/${leadId}`)
    ]);

    const statusOptions = Object.entries(STATUS_MAP).map(([k, v]) =>
        `<option value="${k}" ${k === lead.status ? 'selected' : ''}>${v}</option>`
    ).join('');

    openModal(`线索详情 - ${lead.name || '未命名'}`, `
        <div class="detail-grid">
            <div class="detail-item"><div class="label">电话</div><div class="value">${lead.phone || '-'}</div></div>
            <div class="detail-item"><div class="label">微信</div><div class="value">${lead.wechat || '-'}</div></div>
            <div class="detail-item"><div class="label">学校</div><div class="value">${lead.school_name || '-'}</div></div>
            <div class="detail-item"><div class="label">年级</div><div class="value">${lead.grade || '-'}</div></div>
            <div class="detail-item"><div class="label">来源</div><div class="value">${lead.source || '-'}</div></div>
            <div class="detail-item"><div class="label">负责人</div><div class="value">${lead.owner || '-'}</div></div>
        </div>

        <div style="margin-bottom:16px;">
            <label><strong>跟进状态</strong></label>
            <select id="leadStatusSelect" onchange="updateLeadStatus(${leadId}, this.value)" style="width:100%;padding:8px;border:1px solid var(--gray-300);border-radius:6px;margin-top:4px;">
                ${statusOptions}
            </select>
        </div>

        ${lead.notes ? `<div style="margin-bottom:16px;padding:12px;background:var(--gray-50);border-radius:6px;"><strong>备注：</strong>${lead.notes}</div>` : ''}

        <hr style="border:none;border-top:1px solid var(--gray-200);margin:16px 0;">

        <h4 style="margin-bottom:12px;">📝 添加沟通记录</h4>
        <form id="addInteractionForm">
            <div class="form-row">
                <div class="form-group">
                    <label>沟通方式</label>
                    <select name="interaction_type">
                        <option value="phone">电话</option>
                        <option value="wechat">微信</option>
                        <option value="visit">面谈</option>
                        <option value="other">其他</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>沟通结果</label>
                    <input name="outcome" placeholder="如：同意试听">
                </div>
            </div>
            <div class="form-group">
                <label>沟通内容</label>
                <textarea name="content" rows="3" placeholder="记录沟通要点..."></textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>下一步行动</label>
                    <input name="next_action" placeholder="如：3天后回访">
                </div>
                <div class="form-group">
                    <label>下次跟进时间</label>
                    <input name="next_followup" type="datetime-local">
                </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">保存沟通记录</button>
        </form>

        <hr style="border:none;border-top:1px solid var(--gray-200);margin:20px 0;">

        <h4 style="margin-bottom:12px;">📋 沟通历史 (${interactions.total} 条)</h4>
        <div class="timeline">
            ${interactions.items.length === 0 ? '<p style="color:var(--gray-400);">暂无沟通记录</p>' :
            interactions.items.map(item => `
                <div class="timeline-item">
                    <div class="time">${formatDate(item.created_at)} · ${item.interaction_type === 'phone' ? '📞' : item.interaction_type === 'wechat' ? '💬' : item.interaction_type === 'visit' ? '🤝' : '📝'} ${item.interaction_type}</div>
                    <div class="content">${item.content || '（无详细记录）'}</div>
                    ${item.outcome ? `<div class="outcome">结果：${item.outcome}</div>` : ''}
                    ${item.next_action ? `<div style="font-size:12px;color:var(--gray-500);margin-top:4px;">下一步：${item.next_action}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `);

    $('#addInteractionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        data.lead_id = leadId;
        if (data.next_followup) {
            data.next_followup = new Date(data.next_followup).toISOString();
        }
        try {
            await apiPost('/api/interactions', data);
            showToast('沟通记录已保存！', 'success');
            closeModal();
            renderLeads($('#mainContent'));
        } catch (err) {
            showToast('保存失败：' + err.message, 'error');
        }
    });
};

window.updateLeadStatus = async (leadId, status) => {
    try {
        await apiPut(`/api/leads/${leadId}`, { status });
        showToast('状态已更新', 'success');
    } catch (err) {
        showToast('更新失败：' + err.message, 'error');
    }
};

window.editLead = async (leadId) => {
    const lead = await apiGet(`/api/leads/${leadId}`);
    openModal('编辑线索', `
        <form id="editLeadForm">
            <input type="hidden" name="lead_id" value="${leadId}">
            <div class="form-row">
                <div class="form-group">
                    <label>联系人姓名</label>
                    <input name="name" value="${lead.name || ''}">
                </div>
                <div class="form-group">
                    <label>联系电话</label>
                    <input name="phone" value="${lead.phone || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>微信号</label>
                    <input name="wechat" value="${lead.wechat || ''}">
                </div>
                <div class="form-group">
                    <label>学校名称</label>
                    <input name="school_name" value="${lead.school_name || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" rows="3">${lead.notes || ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">保存修改</button>
        </form>
    `);

    $('#editLeadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        delete data.lead_id;
        try {
            await apiPut(`/api/leads/${leadId}`, data);
            showToast('修改已保存！', 'success');
            closeModal();
            renderLeads($('#mainContent'));
        } catch (err) {
            showToast('修改失败：' + err.message, 'error');
        }
    });
};

window.showImportLeads = () => {
    openModal('批量导入线索', `
        <div style="margin-bottom:16px;">
            <p style="margin-bottom:12px;">选择导入方式：</p>
        </div>
        <div>
            <h4 style="margin-bottom:12px;">📋 粘贴JSON数据</h4>
            <textarea id="importJsonData" rows="8" style="width:100%;padding:8px;border:1px solid var(--gray-300);border-radius:6px;font-family:monospace;font-size:13px;" placeholder='[
        {"name": "王老师", "phone": "138xxxx", "school_name": "育才中学", "status": "new"}
    ]'></textarea>
            <button class="btn btn-primary mt-4" onclick="executeImport()">导入数据</button>
        </div>
        <hr style="margin:20px 0;border:none;border-top:1px solid var(--gray-200);">
        <div>
            <h4 style="margin-bottom:8px;">📥 或使用 Excel 导入</h4>
            <p style="font-size:13px;color:var(--gray-500);">准备一个包含 name, phone, school_name, status 等列的 Excel 文件，保存为 CSV，然后粘贴到这里。</p>
        </div>
    `);
};

window.executeImport = async () => {
    const text = $('#importJsonData')?.value?.trim();
    if (!text) { showToast('请先粘贴数据', 'error'); return; }
    try {
        const data = JSON.parse(text);
        if (!Array.isArray(data) || data.length === 0) {
            showToast('数据格式错误，需要 JSON 数组', 'error');
            return;
        }
        const result = await apiPost('/api/leads/batch-import-exec', data);
        showToast(`成功导入 ${result.imported} 条线索！`, 'success');
        closeModal();
        renderLeads($('#mainContent'));
    } catch (err) {
        showToast('导入失败：' + err.message, 'error');
    }
};

// ═══════════════════════════════════════
// 学校名录 (Schools)
// ═══════════════════════════════════════
let schoolsPageState = { page: 1, keyword: '', city: '' };

async function renderSchools(container, state = schoolsPageState) {
    Object.assign(schoolsPageState, state);
    const { page, keyword, city } = schoolsPageState;
    const params = new URLSearchParams({ page, page_size: 20 });
    if (keyword) params.set('keyword', keyword);
    if (city) params.set('city', city);
    const data = await apiGet(`/api/schools?${params}`);

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>🏫 学校名录</h2>
                <p>学校公开信息库 · 共 ${data.total} 所</p>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="showSchoolCollector()">📍 采集学校</button>
                <button class="btn btn-ghost" onclick="showAddSchool()">+ 手工添加</button>
            </div>
        </div>

        <div class="card">
            <div class="search-bar">
                <input type="text" id="schoolSearch" placeholder="搜索学校名称..." value="${keyword}"
                       onkeyup="if(event.key==='Enter')schoolSearch()">
                <input type="text" id="schoolCity" placeholder="城市（如：北京）" value="${city}"
                       onkeyup="if(event.key==='Enter')schoolSearch()" style="width:140px;">
                <button class="btn btn-primary" onclick="schoolSearch()">🔍 搜索</button>
                <button class="btn btn-ghost" onclick="schoolSearch(true)">🔄 重置</button>
            </div>

            <div class="table-container mobile-cards">
                <table>
                    <thead>
                        <tr>
                            <th>学校名称</th>
                            <th>城市</th>
                            <th>类型</th>
                            <th>联系电话</th>
                            <th>地址</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.length === 0 ? `
                            <tr><td colspan="6" class="text-center" style="padding:40px;color:var(--gray-400);">暂无学校数据，点击"采集学校"开始</td></tr>
                        ` : data.items.map(s => `
                            <tr>
                                <td data-label="学校名称"><strong>${s.name}</strong></td>
                                <td data-label="城市">${s.city || '-'}${s.district ? ' ' + s.district : ''}</td>
                                <td data-label="类型">${renderSchoolTypeTag(s.school_type)}</td>
                                <td data-label="电话">${s.phone || '-'}</td>
                                <td data-label="地址" class="truncate" title="${s.address || ''}">${s.address || '-'}</td>
                                <td data-label="操作">
                                    <button class="btn btn-sm btn-primary" onclick="showSchoolParents(${s.id})">📞 家长资源</button>
                                    <button class="btn btn-sm btn-ghost" onclick="convertSchoolToLead(${s.id})">转为线索</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            ${renderPagination(page, data.total, 20, 'renderSchoolsPage')}
        </div>
    `;
}

window.renderSchoolsPage = (page) => renderSchools($('#mainContent'), { ...schoolsPageState, page });
window.schoolSearch = (reset = false) => {
    const keyword = reset ? '' : $('#schoolSearch')?.value || '';
    const city = reset ? '' : $('#schoolCity')?.value || '';
    renderSchools($('#mainContent'), { page: 1, keyword, city });
};

window.showSchoolCollector = () => {
    openModal('📍 采集学校信息', `
        <p style="margin-bottom:16px;font-size:14px;color:var(--gray-500);">
            通过高德地图API采集指定区域的学校公开信息（名称、地址、联系电话）。
        </p>
        <form id="collectForm">
            <div class="form-row">
                <div class="form-group">
                    <label>城市 *</label>
                    <input name="city" placeholder="如：北京、上海" required>
                </div>
                <div class="form-group">
                    <label>区（可选）</label>
                    <input name="district" placeholder="如：海淀区">
                </div>
            </div>
            <div class="form-group">
                <label>学校类型</label>
                <select name="school_type">
                    <option value="">全部类型</option>
                    <option value="primary">小学</option>
                    <option value="junior">初中</option>
                    <option value="senior">高中</option>
                    <option value="nine_year">九年一贯制</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">开始采集</button>
        </form>
        <div id="collectResult" style="margin-top:16px;display:none;">
            <h4>采集结果</h4>
            <div id="collectProgress"></div>
        </div>
    `);

    $('#collectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        const resultDiv = $('#collectResult');
        const progress = $('#collectProgress');
        resultDiv.style.display = 'block';
        progress.innerHTML = '<p>⏳ 正在采集...</p>';
        try {
            const resp = await apiPost('/api/schools/collect', data);
            progress.innerHTML = `<p>✅ 采集完成！共获取 ${resp.count || 0} 所学校</p>`;
            showToast(`采集完成，获取 ${resp.count} 所学校`, 'success');
            closeModal();
            renderSchools($('#mainContent'));
        } catch (err) {
            progress.innerHTML = `<p style="color:var(--danger);">⚠️ 采集失败：${err.message}</p>`;
        }
    });
};

window.showAddSchool = () => {
    openModal('手工添加学校', `
        <form id="addSchoolForm">
            <div class="form-group">
                <label>学校名称 *</label>
                <input name="name" placeholder="如：北京市育才中学" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>城市</label>
                    <input name="city" placeholder="如：北京">
                </div>
                <div class="form-group">
                    <label>区</label>
                    <input name="district" placeholder="如：海淀区">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>学校类型</label>
                    <select name="school_type">
                        <option value="primary">小学</option>
                        <option value="junior">初中</option>
                        <option value="senior">高中</option>
                        <option value="nine_year">九年一贯制</option>
                        <option value="other">其他</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>联系电话</label>
                    <input name="phone" placeholder="公开电话">
                </div>
            </div>
            <div class="form-group">
                <label>地址</label>
                <input name="address" placeholder="详细地址">
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">保存学校</button>
        </form>
    `);

    $('#addSchoolForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            await apiPost('/api/schools', data);
            showToast('学校已添加！', 'success');
            closeModal();
            renderSchools($('#mainContent'));
        } catch (err) {
            showToast('添加失败：' + err.message, 'error');
        }
    });
};

window.convertSchoolToLead = async (schoolId) => {
    const school = await apiGet(`/api/schools/${schoolId}`);
    openModal('从学校创建线索', `
        <form id="convertForm">
            <input type="hidden" name="school_id" value="${schoolId}">
            <input type="hidden" name="school_name" value="${school.name}">
            <div class="form-group">
                <label>学校</label>
                <input value="${school.name}" disabled style="background:var(--gray-50);">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>联系人姓名</label>
                    <input name="name" placeholder="如：王主任">
                </div>
                <div class="form-group">
                    <label>联系电话 *</label>
                    <input name="phone" value="${school.phone || ''}" placeholder="联系电话">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>角色</label>
                    <select name="role">
                        <option value="parent">家长</option>
                        <option value="teacher">老师</option>
                        <option value="principal">校长</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>线索来源</label>
                    <select name="source">
                        <option value="school_directory">学校名录</option>
                        <option value="cold_call">电话陌拜</option>
                        <option value="ground_push">地推</option>
                    </select>
                </div>
            </div>
            <button type="submit" class="btn btn-success" style="width:100%;">创建线索</button>
        </form>
    `);

    $('#convertForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            await apiPost('/api/leads', data);
            showToast('线索创建成功！', 'success');
            closeModal();
            renderSchools($('#mainContent'));
        } catch (err) {
            showToast('创建失败：' + err.message, 'error');
        }
    });
};

// ── 查看学校关联的家长电话资源 ──
window.showSchoolParents = async (schoolId) => {
    const school = await apiGet(`/api/schools/${schoolId}`);
    const schoolName = school.name;

    openModal(`📞 家长电话资源`, `
        <div style="margin-bottom:16px;">
            <h3 style="margin:0 0 4px;">${schoolName}</h3>
            <p style="margin:0;font-size:13px;color:var(--gray-500);">以下是与该校关联的家长/联系人信息</p>
        </div>
        <div id="parentListContainer" style="min-height:100px;text-align:center;padding:40px 0;color:var(--gray-400);">
            ⏳ 加载中...
        </div>
        <div style="margin-top:16px;display:flex;gap:8px;">
            <button class="btn btn-success" onclick="window.addParentFromSchool(${schoolId})" style="flex:1;">+ 新增家长线索</button>
            <button class="btn btn-ghost" onclick="closeModal()">关闭</button>
        </div>
    `);

    try {
        const data = await apiGet(`/api/leads?school_id=${schoolId}&page_size=200`);
        const container = $('#parentListContainer');
        if (data.total === 0) {
            container.innerHTML = `
                <div style="padding:40px 0;text-align:center;">
                    <div style="font-size:48px;margin-bottom:12px;">📭</div>
                    <p style="color:var(--gray-500);">暂无家长资源</p>
                    <p style="font-size:13px;color:var(--gray-400);">点击下方按钮为该学校添加第一条家长线索</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="margin-bottom:12px;font-size:13px;color:var(--gray-500);">共 ${data.total} 条家长/联系人记录</div>
                <div class="table-container" style="max-height:400px;overflow-y:auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>姓名</th>
                                <th>电话</th>
                                <th>角色</th>
                                <th>年级</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.map(p => `
                                <tr>
                                    <td><strong>${p.name || '-'}</strong></td>
                                    <td><a href="tel:${p.phone}" style="color:var(--primary);text-decoration:none;font-weight:600;">${p.phone || '-'}</a></td>
                                    <td>${renderRoleTag(p.role)}</td>
                                    <td>${p.grade || '-'}</td>
                                    <td>${renderStatusTag(p.status)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (err) {
        $('#parentListContainer').innerHTML = `
            <div style="padding:40px 0;text-align:center;color:var(--danger);">
                ⚠️ 加载失败：${err.message}
            </div>
        `;
    }
};

window.addParentFromSchool = async (schoolId) => {
    closeModal();
    const school = await apiGet(`/api/schools/${schoolId}`);
    openModal('从学校创建线索', `
        <form id="convertForm">
            <input type="hidden" name="school_id" value="${schoolId}">
            <input type="hidden" name="school_name" value="${school.name}">
            <div class="form-group">
                <label>学校</label>
                <input value="${school.name}" disabled style="background:var(--gray-50);">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>家长姓名 *</label>
                    <input name="name" placeholder="如：张妈妈" required>
                </div>
                <div class="form-group">
                    <label>联系电话 *</label>
                    <input name="phone" placeholder="家长手机号" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>学生年级</label>
                    <select name="grade">
                        <option value="">选择年级</option>
                        <option value="一年级">一年级</option>
                        <option value="二年级">二年级</option>
                        <option value="三年级">三年级</option>
                        <option value="四年级">四年级</option>
                        <option value="五年级">五年级</option>
                        <option value="六年级">六年级</option>
                        <option value="初一">初一</option>
                        <option value="初二">初二</option>
                        <option value="初三">初三</option>
                        <option value="高一">高一</option>
                        <option value="高二">高二</option>
                        <option value="高三">高三</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>线索来源</label>
                    <select name="source">
                        <option value="school_directory">学校名录</option>
                        <option value="cold_call">电话陌拜</option>
                        <option value="ground_push">地推</option>
                    </select>
                </div>
            </div>
            <button type="submit" class="btn btn-success" style="width:100%;">保存家长电话</button>
        </form>
    `);

    $('#convertForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            await apiPost('/api/leads', data);
            showToast('家长线索创建成功！', 'success');
            closeModal();
            renderSchools($('#mainContent'));
        } catch (err) {
            showToast('创建失败：' + err.message, 'error');
        }
    });
};

// ═══════════════════════════════════════
// 统计分析 (Stats)
// ═══════════════════════════════════════
async function renderStats(container) {
    const [overview, funnel, bySource, performance] = await Promise.all([
        apiGet('/api/stats/overview'),
        apiGet('/api/stats/conversion-funnel'),
        apiGet('/api/leads/stats/by-source'),
        apiGet('/api/stats/owner-performance'),
    ]);

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>📈 统计分析</h2>
                <p>全面了解获客与转化效果</p>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${overview.total_leads}</div><div class="stat-label">总线索</div></div>
            <div class="stat-card success"><div class="stat-value">${overview.converted}</div><div class="stat-label">成交</div></div>
            <div class="stat-card warning"><div class="stat-value">${overview.conversion_rate}%</div><div class="stat-label">转化率</div></div>
            <div class="stat-card info"><div class="stat-value">${overview.total_schools}</div><div class="stat-label">学校库</div></div>
        </div>

        <div class="card">
            <div class="card-header"><h3>🔄 转化漏斗</h3></div>
            ${funnel.length === 0 ? '<p style="color:var(--gray-400);">暂无数据</p>' :
            funnel.map((f, i) => `
                <div style="margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                        <span>${f.label}</span>
                        <span>${f.count} (${f.percentage}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="fill" style="width:${f.percentage}%;background:hsl(${200 - i * 20}, 70%, ${55 + i * 3}%)"></div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="card">
                <div class="card-header"><h3>📊 线索来源分布</h3></div>
                ${Object.entries(bySource).length === 0 ? '<p style="color:var(--gray-400);">暂无数据</p>' :
                Object.entries(bySource).map(([source, count]) => `
                    <div style="margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;font-size:13px;">
                            <span>${source}</span>
                            <span>${count}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="fill" style="width:${(count / Math.max(...Object.values(bySource)) * 100).toFixed(0)}%;background:var(--info);"></div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="card">
                <div class="card-header"><h3>👤 团队业绩</h3></div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>负责人</th><th>线索量</th><th>成交</th><th>转化率</th></tr></thead>
                        <tbody>
                            ${performance.length === 0 ? '<tr><td colspan="4" class="text-center" style="color:var(--gray-400);">暂无数据</td></tr>' :
                            performance.map(p => `
                                <tr>
                                    <td><strong>${p.owner}</strong></td>
                                    <td>${p.total_leads}</td>
                                    <td>${p.converted}</td>
                                    <td>${p.rate}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

/* ═══════════════════════════════════════
   ═════════════════════════════════════════
   新功能页面
   ═════════════════════════════════════════
   ═══════════════════════════════════════ */

// ═══════════════════════════════════════
// 校区管理 (Campus)
// ═══════════════════════════════════════
let campusPageState = { page: 1, keyword: '', pageSize: 20 };

async function renderCampus(container, state = campusPageState) {
    if (!hasRole('super_admin')) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div><p>权限不足，仅超级管理员可管理校区</p></div>';
        return;
    }

    Object.assign(campusPageState, state);
    const { page, keyword } = campusPageState;
    const params = new URLSearchParams({ page, page_size: 20 });
    if (keyword) params.set('keyword', keyword);
    const data = await apiGet(`/api/campus?${params}`);

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>🏢 校区管理</h2>
                <p>管理所有校区 · 共 ${data.total} 个</p>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="showCreateCampus()">+ 新增校区</button>
            </div>
        </div>

        <div class="card">
            <div class="search-bar">
                <input type="text" id="campusSearch" placeholder="搜索校区名称..." value="${keyword}"
                       onkeyup="if(event.key==='Enter')campusSearch()">
                <button class="btn btn-primary" onclick="campusSearch()">🔍 搜索</button>
                <button class="btn btn-ghost" onclick="campusSearch(true)">🔄 重置</button>
            </div>

            <div class="table-container mobile-cards">
                <table>
                    <thead><tr><th>校区名称</th><th>编码</th><th>联系电话</th><th>联系人</th><th>状态</th><th>操作</th></tr></thead>
                    <tbody>
                        ${data.items.length === 0 ? '<tr><td colspan="6" class="text-center" style="padding:40px;color:var(--gray-400);">暂无校区数据</td></tr>' :
                        data.items.map(c => `
                            <tr>
                                <td data-label="校区名称"><strong>${c.name}</strong></td>
                                <td data-label="编码">${c.code || '-'}</td>
                                <td data-label="电话">${c.phone || '-'}</td>
                                <td data-label="联系人">${c.contact_person || '-'}</td>
                                <td data-label="状态">${c.is_active ? '✅ 启用' : '⛔ 停用'}</td>
                                <td data-label="操作">
                                    <button class="btn btn-sm btn-ghost" onclick="editCampus(${c.id})">编辑</button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteCampus(${c.id}, '${c.name}')">删除</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${renderPagination(page, data.total, campusPageState.pageSize, 'renderCampusPage')}
        </div>
    `;
}

window.renderCampusPage = (page) => renderCampus($('#mainContent'), { ...campusPageState, page });
window.campusSearch = (reset = false) => {
    const keyword = reset ? '' : $('#campusSearch')?.value || '';
    renderCampus($('#mainContent'), { page: 1, keyword });
};

window.showCreateCampus = () => {
    openModal('新增校区', `
        <form id="createCampusForm">
            <div class="form-row">
                <div class="form-group">
                    <label>校区名称 *</label>
                    <input name="name" placeholder="如：海淀校区" required>
                </div>
                <div class="form-group">
                    <label>校区编码</label>
                    <input name="code" placeholder="如：HD">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>联系电话</label>
                    <input name="phone" placeholder="010-88888888">
                </div>
                <div class="form-group">
                    <label>联系人</label>
                    <input name="contact_person" placeholder="如：张校长">
                </div>
            </div>
            <div class="form-group">
                <label>地址</label>
                <input name="address" placeholder="详细地址">
            </div>
            <button type="submit" class="btn btn-success" style="width:100%;">创建校区</button>
        </form>
    `);

    $('#createCampusForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            await apiPost('/api/campus', data);
            showToast('校区创建成功！', 'success');
            closeModal();
            renderCampus($('#mainContent'));
        } catch (err) {
            showToast('创建失败：' + err.message, 'error');
        }
    });
};

window.editCampus = async (campusId) => {
    const campus = await apiGet(`/api/campus/${campusId}`);
    openModal('编辑校区', `
        <form id="editCampusForm">
            <div class="form-row">
                <div class="form-group">
                    <label>校区名称</label>
                    <input name="name" value="${campus.name || ''}">
                </div>
                <div class="form-group">
                    <label>校区编码</label>
                    <input name="code" value="${campus.code || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>联系电话</label>
                    <input name="phone" value="${campus.phone || ''}">
                </div>
                <div class="form-group">
                    <label>联系人</label>
                    <input name="contact_person" value="${campus.contact_person || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>地址</label>
                <input name="address" value="${campus.address || ''}">
            </div>
            <div class="form-group">
                <label>状态</label>
                <select name="is_active">
                    <option value="true" ${campus.is_active ? 'selected' : ''}>启用</option>
                    <option value="false" ${!campus.is_active ? 'selected' : ''}>停用</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">保存修改</button>
        </form>
    `);

    $('#editCampusForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        if (data.is_active === 'true') data.is_active = true;
        if (data.is_active === 'false') data.is_active = false;
        try {
            await apiPut(`/api/campus/${campusId}`, data);
            showToast('校区已更新！', 'success');
            closeModal();
            renderCampus($('#mainContent'));
        } catch (err) {
            showToast('更新失败：' + err.message, 'error');
        }
    });
};

window.deleteCampus = (campusId, name) => {
    if (!confirm(`确定要删除校区「${name}」吗？此操作不可撤销。`)) return;
    apiDelete(`/api/campus/${campusId}`).then(() => {
        showToast('校区已删除', 'success');
        renderCampus($('#mainContent'));
    }).catch(err => {
        showToast('删除失败：' + err.message, 'error');
    });
};

// ═══════════════════════════════════════
// 员工管理 (Staff)
// ═══════════════════════════════════════
let staffPageState = { page: 1, role: '', campus_id: '', pageSize: 20 };

async function renderStaff(container, state = staffPageState) {
    const canManage = hasRole('super_admin', 'campus_admin');
    if (!canManage && !hasRole('principal')) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div><p>权限不足</p></div>';
        return;
    }

    Object.assign(staffPageState, state);
    const { page, role, campus_id } = staffPageState;
    const params = new URLSearchParams({ page, page_size: 20 });
    if (role) params.set('role', role);
    if (campus_id) params.set('campus_id', campus_id);
    const data = await apiGet(`/api/staff?${params}`);

    // 校区列表（用于筛选）
    let campuses = [];
    if (hasRole('super_admin')) {
        try { campuses = (await apiGet('/api/campus?page=1&page_size=100')).items; } catch {}
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>👤 员工管理</h2>
                <p>管理团队成员 · 共 ${data.total} 人</p>
            </div>
            ${canManage ? `
            <div class="btn-group">
                <button class="btn btn-success" onclick="showCreateStaff()">+ 添加员工</button>
            </div>
            ` : ''}
        </div>

        <div class="card">
            <div class="search-bar">
                ${hasRole('super_admin') ? `
                <select id="staffCampusFilter" onchange="staffSearch()" style="width:140px;">
                    <option value="">全部校区</option>
                    ${campuses.map(c => `<option value="${c.id}" ${c.id == campus_id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
                ` : ''}
                <select id="staffRoleFilter" onchange="staffSearch()" style="width:130px;">
                    <option value="">全部角色</option>
                    <option value="super_admin" ${role === 'super_admin' ? 'selected' : ''}>超级管理员</option>
                    <option value="campus_admin" ${role === 'campus_admin' ? 'selected' : ''}>校区管理员</option>
                    <option value="principal" ${role === 'principal' ? 'selected' : ''}>校长</option>
                    <option value="staff" ${role === 'staff' ? 'selected' : ''}>员工</option>
                </select>
                <button class="btn btn-ghost" onclick="staffSearch(true)">🔄 重置</button>
            </div>

            <div class="table-container mobile-cards">
                <table>
                    <thead><tr><th>姓名</th><th>手机号</th><th>角色</th><th>校区</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
                    <tbody>
                        ${data.items.length === 0 ? '<tr><td colspan="7" class="text-center" style="padding:40px;color:var(--gray-400);">暂无员工数据</td></tr>' :
                        data.items.map(s => `
                            <tr>
                                <td data-label="姓名"><strong>${s.display_name || '-'}</strong></td>
                                <td data-label="手机号">${s.phone}</td>
                                <td data-label="角色">${getRoleLabel(s.role)}</td>
                                <td data-label="校区">${s.campus_id || '-'}</td>
                                <td data-label="状态">${s.is_active ? '✅ 在职' : '⛔ 离职'}</td>
                                <td data-label="创建时间">${formatDateShort(s.created_at)}</td>
                                <td data-label="操作">
                                    ${canManage ? `
                                    <button class="btn btn-sm btn-ghost" onclick="editStaff(${s.id})">编辑</button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteStaff(${s.id}, '${s.display_name || s.phone}')">删除</button>
                                    ` : '-'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${renderPagination(page, data.total, staffPageState.pageSize, 'renderStaffPage')}
        </div>
    `;
}

window.renderStaffPage = (page) => renderStaff($('#mainContent'), { ...staffPageState, page });
window.staffSearch = (reset = false) => {
    const role = reset ? '' : $('#staffRoleFilter')?.value || '';
    const campus_id = reset ? '' : $('#staffCampusFilter')?.value || '';
    renderStaff($('#mainContent'), { page: 1, role, campus_id });
};

window.showCreateStaff = () => {
    openModal('添加员工', `
        <form id="createStaffForm">
            <div class="form-row">
                <div class="form-group">
                    <label>手机号 *</label>
                    <input name="phone" placeholder="11位手机号" maxlength="11" required>
                </div>
                <div class="form-group">
                    <label>显示名称</label>
                    <input name="display_name" placeholder="如：张三">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>角色</label>
                    <select name="role">
                        ${hasRole('super_admin') ? `<option value="super_admin">超级管理员</option>` : ''}
                        <option value="campus_admin">校区管理员</option>
                        <option value="staff" selected>员工</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>所属校区</label>
                    <select name="campus_id" id="createStaffCampus">
                        <option value="">请选择校区</option>
                    </select>
                </div>
            </div>
            <p style="font-size:12px;color:var(--gray-400);margin-bottom:16px;">默认验证码为 888888，员工首次登录时使用手机号 + 888888 登录</p>
            <button type="submit" class="btn btn-success" style="width:100%;">添加员工</button>
        </form>
    `);

    // 加载校区列表
    (async () => {
        try {
            const campuses = (await apiGet('/api/campus?page=1&page_size=100')).items;
            const sel = $('#createStaffCampus');
            campuses.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                sel.appendChild(opt);
            });
        } catch {}
    })();

    $('#createStaffForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        if (!data.campus_id) data.campus_id = null;
        try {
            await apiPost('/api/staff', data);
            showToast('员工添加成功！', 'success');
            closeModal();
            renderStaff($('#mainContent'));
        } catch (err) {
            showToast('添加失败：' + err.message, 'error');
        }
    });
};

window.editStaff = async (staffId) => {
    // We need to fetch staff data - but the list endpoint returns all info, let's just use that
    // Actually we need a detail endpoint, let's work with what we have
    const staffData = (await apiGet('/api/staff?page=1&page_size=100')).items.find(s => s.id === staffId);
    if (!staffData) { showToast('获取员工信息失败', 'error'); return; }

    openModal('编辑员工', `
        <form id="editStaffForm">
            <div class="form-row">
                <div class="form-group">
                    <label>显示名称</label>
                    <input name="display_name" value="${staffData.display_name || ''}">
                </div>
                <div class="form-group">
                    <label>角色</label>
                    <select name="role">
                        ${hasRole('super_admin') ? `<option value="super_admin" ${staffData.role === 'super_admin' ? 'selected' : ''}>超级管理员</option>` : ''}
                        <option value="campus_admin" ${staffData.role === 'campus_admin' ? 'selected' : ''}>校区管理员</option>
                        <option value="staff" ${staffData.role === 'staff' ? 'selected' : ''}>员工</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>状态</label>
                <select name="is_active">
                    <option value="true" ${staffData.is_active ? 'selected' : ''}>在职</option>
                    <option value="false" ${!staffData.is_active ? 'selected' : ''}>离职</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">保存修改</button>
        </form>
    `);

    $('#editStaffForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        if (data.is_active === 'true') data.is_active = true;
        if (data.is_active === 'false') data.is_active = false;
        try {
            await apiPut(`/api/staff/${staffId}`, data);
            showToast('员工信息已更新！', 'success');
            closeModal();
            renderStaff($('#mainContent'));
        } catch (err) {
            showToast('更新失败：' + err.message, 'error');
        }
    });
};

window.deleteStaff = (staffId, name) => {
    if (!confirm(`确定要删除员工「${name}」吗？`)) return;
    apiDelete(`/api/staff/${staffId}`).then(() => {
        showToast('员工已删除', 'success');
        renderStaff($('#mainContent'));
    }).catch(err => {
        showToast('删除失败：' + err.message, 'error');
    });
};

// ═══════════════════════════════════════
// 成交管理 (Deals)
// ═══════════════════════════════════════
let dealsPageState = { page: 1, keyword: '', status: '', date_from: '', date_to: '', pageSize: 20 };

async function renderDeals(container, state = dealsPageState) {
    Object.assign(dealsPageState, state);
    const { page, keyword, status, date_from, date_to } = dealsPageState;
    const params = new URLSearchParams({ page, page_size: 20 });
    if (keyword) params.set('keyword', keyword);
    if (status) params.set('status', status);
    if (date_from) params.set('date_from', date_from);
    if (date_to) params.set('date_to', date_to);
    const data = await apiGet(`/api/deals?${params}`);

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>💰 成交管理</h2>
                <p>管理所有成交记录 · 共 ${data.total} 条</p>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="showCreateDeal()">+ 新建成交</button>
            </div>
        </div>

        <div class="card">
            <div class="search-bar">
                <input type="text" id="dealSearch" placeholder="搜索客户/课程..." value="${keyword}"
                       onkeyup="if(event.key==='Enter')dealSearch()" style="min-width:140px;">
                <select id="dealStatusFilter" onchange="dealSearch()" style="width:120px;">
                    <option value="">全部状态</option>
                    <option value="confirmed" ${status === 'confirmed' ? 'selected' : ''}>已成交</option>
                    <option value="refunded" ${status === 'refunded' ? 'selected' : ''}>已退款</option>
                </select>
                <input type="date" id="dealDateFrom" value="${date_from}" onchange="dealSearch()" style="width:130px;">
                <input type="date" id="dealDateTo" value="${date_to}" onchange="dealSearch()" style="width:130px;">
                <button class="btn btn-ghost" onclick="dealSearch(true)">🔄 重置</button>
            </div>

            <div class="table-container mobile-cards">
                <table>
                    <thead><tr><th>客户</th><th>电话</th><th>课程</th><th>金额</th><th>成交日期</th><th>状态</th><th>操作</th></tr></thead>
                    <tbody>
                        ${data.items.length === 0 ? '<tr><td colspan="7" class="text-center" style="padding:40px;color:var(--gray-400);">暂无成交记录</td></tr>' :
                        data.items.map(d => `
                            <tr>
                                <td data-label="客户"><strong>${d.lead_name || '-'}</strong></td>
                                <td data-label="电话">${d.lead_phone || '-'}</td>
                                <td data-label="课程">${d.course_name || '-'}</td>
                                <td data-label="金额"><strong style="color:var(--success);">${formatMoney(d.amount)}</strong></td>
                                <td data-label="成交日期">${formatDateShort(d.deal_date)}</td>
                                <td data-label="状态">${d.status === 'confirmed' ? '✅ 已成交' : d.status === 'refunded' ? '🔙 已退款' : d.status}</td>
                                <td data-label="操作">
                                    <button class="btn btn-sm btn-ghost" onclick="showDealDetail(${d.id})">详情</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${renderPagination(page, data.total, dealsPageState.pageSize, 'renderDealsPage')}
        </div>
    `;
}

window.renderDealsPage = (page) => renderDeals($('#mainContent'), { ...dealsPageState, page });
window.dealSearch = (reset = false) => {
    const keyword = reset ? '' : $('#dealSearch')?.value || '';
    const status = reset ? '' : $('#dealStatusFilter')?.value || '';
    const date_from = reset ? '' : $('#dealDateFrom')?.value || '';
    const date_to = reset ? '' : $('#dealDateTo')?.value || '';
    renderDeals($('#mainContent'), { page: 1, keyword, status, date_from, date_to });
};

// 从线索创建成交（供线索详情页调用）
window.showCreateDeal = async (leadId) => {
    let lead = null;
    if (leadId) {
        try { lead = await apiGet(`/api/leads/${leadId}`); } catch {}
    }

    if (!hasRole('super_admin', 'campus_admin')) {
        showToast('权限不足，仅管理员可创建成交', 'error');
        return;
    }

    openModal('新建成交记录', `
        <form id="createDealForm">
            <div class="form-group">
                <label>选择客户线索</label>
                <select name="lead_id" id="dealLeadSelect" required>
                    <option value="">请选择线索</option>
                    ${lead ? `<option value="${lead.id}" selected>${lead.name} (${lead.phone})</option>` : ''}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>成交课程 *</label>
                    <input name="course_name" placeholder="如：单词速记特训营" required>
                </div>
                <div class="form-group">
                    <label>成交金额 *</label>
                    <input name="amount" type="number" step="0.01" min="0" placeholder="如：2999.00" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>成交日期</label>
                    <input name="deal_date" type="date" value="${new Date().toISOString().slice(0, 10)}">
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select name="status">
                        <option value="confirmed">已成交</option>
                        <option value="refunded">已退款</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" rows="2" placeholder="备注信息..."></textarea>
            </div>
            <p style="font-size:12px;color:var(--gray-400);margin-bottom:12px;">创建成交后将自动计算佣金并更新线索状态</p>
            <button type="submit" class="btn btn-success" style="width:100%;">创建成交</button>
        </form>
    `);

    // 加载线索列表
    (async () => {
        try {
            const leads = (await apiGet('/api/leads?page=1&page_size=500')).items;
            const sel = $('#dealLeadSelect');
            if (sel) {
                leads.forEach(l => {
                    const opt = document.createElement('option');
                    opt.value = l.id;
                    opt.textContent = `${l.name || '未知'} (${l.phone || '无电话'}) - ${STATUS_MAP[l.status] || l.status}`;
                    sel.appendChild(opt);
                });
            }
        } catch {}
    })();

    $('#createDealForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        if (data.deal_date) {
            data.deal_date = new Date(data.deal_date).toISOString();
        }
        try {
            await apiPost('/api/deals', data);
            showToast('成交记录创建成功！佣金已自动计算。', 'success');
            closeModal();
            renderDeals($('#mainContent'));
        } catch (err) {
            showToast('创建失败：' + err.message, 'error');
        }
    });
};

window.showDealDetail = async (dealId) => {
    // Get deal from list, then fetch audit
    const deal = (await apiGet('/api/deals?page=1&page_size=500')).items.find(d => d.id === dealId);
    if (!deal) { showToast('获取成交详情失败', 'error'); return; }

    let auditHtml = '';
    try {
        const audit = await apiGet(`/api/audit-logs/target/deal/${dealId}`);
        if (audit.items && audit.items.length > 0) {
            auditHtml = `
                <hr style="border:none;border-top:1px solid var(--gray-200);margin:16px 0;">
                <h4 style="margin-bottom:12px;">📋 操作记录（${audit.items.length} 条）</h4>
                ${audit.items.slice(0, 10).map(log => `
                    <div class="audit-entry ${log.action_type}">
                        <div class="audit-meta">${formatDate(log.created_at)} · ${log.user_name || '系统'}</div>
                        <div class="audit-action">${log.action_type === 'create' ? '📝 创建' : log.action_type === 'update' ? '✏️ 修改' : '🗑️ 删除'}</div>
                        ${log.field_name ? `<div class="audit-changes"><div class="change-row">
                            <span class="change-field">${log.field_name}</span>
                            <span class="change-old">${log.old_value || ''}</span>
                            <span>→</span>
                            <span class="change-new">${log.new_value || ''}</span>
                        </div></div>` : ''}
                    </div>
                `).join('')}
            `;
        }
    } catch {}

    openModal('成交详情', `
        <div class="detail-grid">
            <div class="detail-item"><div class="label">客户</div><div class="value">${deal.lead_name || '-'}</div></div>
            <div class="detail-item"><div class="label">电话</div><div class="value">${deal.lead_phone || '-'}</div></div>
            <div class="detail-item"><div class="label">课程</div><div class="value">${deal.course_name}</div></div>
            <div class="detail-item"><div class="label">金额</div><div class="value" style="color:var(--success);font-weight:700;">${formatMoney(deal.amount)}</div></div>
            <div class="detail-item"><div class="label">成交日期</div><div class="value">${formatDateShort(deal.deal_date)}</div></div>
            <div class="detail-item"><div class="label">状态</div><div class="value">${deal.status === 'confirmed' ? '✅ 已成交' : '🔙 已退款'}</div></div>
        </div>
        ${deal.notes ? `<div style="padding:12px;background:var(--gray-50);border-radius:6px;"><strong>备注：</strong>${deal.notes}</div>` : ''}
        ${auditHtml}
    `);
};

// ═══════════════════════════════════════
// 佣金管理 (Commission)
// ═══════════════════════════════════════
async function renderCommission(container) {
    // 规则列表（管理员可见）
    let rules = { items: [] };
    if (hasRole('super_admin', 'campus_admin')) {
        try { rules = await apiGet('/api/commission/rules'); } catch {}
    }

    // 发放记录（按角色过滤）
    const records = await apiGet('/api/commission/records?page=1&page_size=500');

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>🏆 佣金管理</h2>
                <p>佣金规则与发放记录</p>
            </div>
            ${hasRole('super_admin', 'campus_admin') ? `
            <div class="btn-group">
                <button class="btn btn-primary" onclick="showCreateCommissionRule()">+ 添加规则</button>
            </div>
            ` : ''}
        </div>

        ${hasRole('super_admin', 'campus_admin') ? `
        <div class="card">
            <div class="card-header"><h3>📐 佣金规则</h3></div>
            <div class="table-container mobile-cards">
                <table>
                    <thead><tr><th>规则名称</th><th>校区</th><th>适用角色</th><th>类型</th><th>比例/金额</th><th>状态</th><th>操作</th></tr></thead>
                    <tbody>
                        ${rules.items.length === 0 ? '<tr><td colspan="7" class="text-center" style="padding:30px;color:var(--gray-400);">暂未设置佣金规则</td></tr>' :
                        rules.items.map(r => `
                            <tr>
                                <td data-label="规则名称"><strong>${r.name}</strong></td>
                                <td data-label="校区">${r.campus_name || '-'}</td>
                                <td data-label="适用角色">${r.role_type === 'staff' ? '员工' : r.role_type === 'campus_admin' ? '校区管理员' : r.role_type}</td>
                                <td data-label="类型">${r.commission_type === 'percentage' ? '百分比' : '固定金额'}</td>
                                <td data-label="比例/金额">${r.commission_type === 'percentage' ? (parseFloat(r.commission_value) * 100).toFixed(1) + '%' : formatMoney(r.commission_value)}</td>
                                <td data-label="状态">${r.is_active ? '✅ 启用' : '⛔ 停用'}</td>
                                <td data-label="操作">
                                    <button class="btn btn-sm btn-ghost" onclick="editCommissionRule(${r.id})">编辑</button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteCommissionRule(${r.id}, '${r.name}')">删除</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}

        <div class="card">
            <div class="card-header"><h3>📊 佣金发放记录</h3></div>
            <div class="table-container mobile-cards">
                <table>
                    <thead><tr><th>人员</th><th>关联成交</th><th>佣金金额</th><th>状态</th><th>发放时间</th>${hasRole('super_admin', 'campus_admin') ? '<th>操作</th>' : ''}</tr></thead>
                    <tbody>
                        ${records.items.length === 0 ? '<tr><td colspan="6" class="text-center" style="padding:40px;color:var(--gray-400);">暂无佣金记录</td></tr>' :
                        records.items.map(r => `
                            <tr>
                                <td data-label="人员"><strong>${r.user_name || '未知'}</strong></td>
                                <td data-label="关联成交">${r.deal_info || '-'}</td>
                                <td data-label="佣金金额"><strong style="color:var(--success);">${formatMoney(r.commission_amount)}</strong></td>
                                <td data-label="状态"><span class="tag tag-${r.status}">${r.status === 'paid' ? '✅ 已发放' : '⏳ 待发放'}</span></td>
                                <td data-label="发放时间">${r.paid_at ? formatDateShort(r.paid_at) : '-'}</td>
                                ${hasRole('super_admin', 'campus_admin') ? `
                                <td data-label="操作">
                                    ${r.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="payCommission(${r.id})">发放</button>` : '-'}
                                </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

window.showCreateCommissionRule = () => {
    openModal('添加佣金规则', `
        <form id="createCommissionRuleForm">
            <div class="form-group">
                <label>规则名称 *</label>
                <input name="name" placeholder="如：销售提成 5%" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>适用角色</label>
                    <select name="role_type">
                        <option value="staff">员工</option>
                        <option value="campus_admin">校区管理员</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>所属校区</label>
                    <select name="campus_id" id="ruleCampusSelect">
                        <option value="">选择校区</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>佣金类型</label>
                    <select name="commission_type" id="commissionTypeSelect">
                        <option value="percentage">百分比 (%)</option>
                        <option value="fixed">固定金额 (¥)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label id="commissionValueLabel">比例值 (如 0.05 = 5%)</label>
                    <input name="commission_value" type="number" step="0.001" min="0" placeholder="0.05" required>
                </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">创建规则</button>
        </form>
    `);

    // 加载校区列表
    (async () => {
        try {
            const campuses = (await apiGet('/api/campus?page=1&page_size=100')).items;
            const sel = $('#ruleCampusSelect');
            campuses.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                sel.appendChild(opt);
            });
            // Default to current user's campus
            if (currentUser.campus_id && !hasRole('super_admin')) {
                sel.value = currentUser.campus_id;
            }
        } catch {}
    })();

    $('#commissionTypeSelect').addEventListener('change', (e) => {
        const label = $('#commissionValueLabel');
        if (e.target.value === 'percentage') {
            label.textContent = '比例值 (如 0.05 = 5%)';
        } else {
            label.textContent = '固定金额 (元)';
        }
    });

    $('#createCommissionRuleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        if (!data.campus_id) { showToast('请选择校区', 'error'); return; }
        data.campus_id = parseInt(data.campus_id);
        try {
            await apiPost('/api/commission/rules', data);
            showToast('佣金规则创建成功！', 'success');
            closeModal();
            renderCommission($('#mainContent'));
        } catch (err) {
            showToast('创建失败：' + err.message, 'error');
        }
    });
};

window.editCommissionRule = async (ruleId) => {
    const rules = (await apiGet('/api/commission/rules')).items;
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) { showToast('获取规则信息失败', 'error'); return; }

    openModal('编辑佣金规则', `
        <form id="editCommissionRuleForm">
            <div class="form-group">
                <label>规则名称</label>
                <input name="name" value="${rule.name}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>适用角色</label>
                    <select name="role_type">
                        <option value="staff" ${rule.role_type === 'staff' ? 'selected' : ''}>员工</option>
                        <option value="campus_admin" ${rule.role_type === 'campus_admin' ? 'selected' : ''}>校区管理员</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>佣金类型</label>
                    <select name="commission_type">
                        <option value="percentage" ${rule.commission_type === 'percentage' ? 'selected' : ''}>百分比 (%)</option>
                        <option value="fixed" ${rule.commission_type === 'fixed' ? 'selected' : ''}>固定金额 (¥)</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>值</label>
                    <input name="commission_value" type="number" step="0.001" value="${rule.commission_value}" required>
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select name="is_active">
                        <option value="true" ${rule.is_active ? 'selected' : ''}>启用</option>
                        <option value="false" ${!rule.is_active ? 'selected' : ''}>停用</option>
                    </select>
                </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">保存修改</button>
        </form>
    `);

    $('#editCommissionRuleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        if (data.is_active === 'true') data.is_active = true;
        if (data.is_active === 'false') data.is_active = false;
        try {
            await apiPut(`/api/commission/rules/${ruleId}`, data);
            showToast('规则已更新！', 'success');
            closeModal();
            renderCommission($('#mainContent'));
        } catch (err) {
            showToast('更新失败：' + err.message, 'error');
        }
    });
};

window.deleteCommissionRule = (ruleId, name) => {
    if (!confirm(`确定要删除佣金规则「${name}」吗？`)) return;
    apiDelete(`/api/commission/rules/${ruleId}`).then(() => {
        showToast('规则已删除', 'success');
        renderCommission($('#mainContent'));
    }).catch(err => {
        showToast('删除失败：' + err.message, 'error');
    });
};

window.payCommission = async (recordId) => {
    if (!confirm('确定标记该笔佣金为「已发放」吗？')) return;
    try {
        await apiPost(`/api/commission/records/${recordId}/pay`);
        showToast('佣金已发放', 'success');
        renderCommission($('#mainContent'));
    } catch (err) {
        showToast('操作失败：' + err.message, 'error');
    }
};

// ═══════════════════════════════════════
// 操作留痕 (Audit Log)
// ═══════════════════════════════════════
let auditPageState = { page: 1, target_type: '', action_type: '', pageSize: 50 };

async function renderAudit(container, state = auditPageState) {
    Object.assign(auditPageState, state);
    const { page, target_type, action_type } = auditPageState;
    const params = new URLSearchParams({ page, page_size: 50 });
    if (target_type) params.set('target_type', target_type);
    if (action_type) params.set('action_type', action_type);
    const data = await apiGet(`/api/audit-logs?${params}`);

    const actionLabels = { create: '📝 创建', update: '✏️ 修改', delete: '🗑️ 删除' };
    const typeLabels = { lead: '线索', deal: '成交', interaction: '沟通', school: '学校', campus: '校区', staff: '员工', social_account: '社媒账号', social_post: '采集帖子', keyword_config: '关键词配置', collection_task: '采集任务' };

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>📋 操作留痕</h2>
                <p>所有操作审计日志 · 共 ${data.total} 条</p>
            </div>
        </div>

        <div class="card">
            <div class="search-bar">
                <select id="auditTypeFilter" onchange="auditSearch()" style="width:130px;">
                    <option value="">全部类型</option>
                    ${Object.entries(typeLabels).map(([k, v]) =>
                        `<option value="${k}" ${k === target_type ? 'selected' : ''}>${v}</option>`
                    ).join('')}
                </select>
                <select id="auditActionFilter" onchange="auditSearch()" style="width:120px;">
                    <option value="">全部操作</option>
                    <option value="create" ${action_type === 'create' ? 'selected' : ''}>创建</option>
                    <option value="update" ${action_type === 'update' ? 'selected' : ''}>修改</option>
                    <option value="delete" ${action_type === 'delete' ? 'selected' : ''}>删除</option>
                </select>
                <button class="btn btn-ghost" onclick="auditSearch(true)">🔄 重置</button>
            </div>

            <div style="margin-bottom:16px;">
                ${data.items.length === 0 ? '<p style="color:var(--gray-400);padding:30px;text-align:center;">暂无审计日志</p>' :
                data.items.map(log => `
                    <div class="audit-entry ${log.action_type}">
                        <div class="audit-meta">
                            ${formatDate(log.created_at)} · ${log.user_name || '未知用户'} (${getRoleLabel(log.user_role) || '-'})
                        </div>
                        <div class="audit-action">
                            ${actionLabels[log.action_type] || log.action_type}
                            ${typeLabels[log.target_type] || log.target_type}
                            ${log.target_id ? `#${log.target_id}` : ''}
                        </div>
                        ${log.field_name ? `
                        <div class="audit-changes">
                            <div class="change-row">
                                <span class="change-field">${log.field_name}</span>
                                <span class="change-old">${log.old_value || '(空)'}</span>
                                <span>→</span>
                                <span class="change-new">${log.new_value || '(空)'}</span>
                            </div>
                        </div>
                        ` : `
                        ${log.new_value ? `<div class="audit-changes"><span style="color:var(--gray-500);">${log.new_value.slice(0, 100)}</span></div>` : ''}
                        `}
                        ${log.ip_address ? `<div style="font-size:11px;color:var(--gray-400);margin-top:4px;">IP: ${log.ip_address}</div>` : ''}
                    </div>
                `).join('')}
            </div>
            ${renderPagination(page, data.total, auditPageState.pageSize, 'renderAuditPage')}
        </div>
    `;
}

window.renderAuditPage = (page) => renderAudit($('#mainContent'), { ...auditPageState, page });
window.auditSearch = (reset = false) => {
    const target_type = reset ? '' : $('#auditTypeFilter')?.value || '';
    const action_type = reset ? '' : $('#auditActionFilter')?.value || '';
    renderAudit($('#mainContent'), { page: 1, target_type, action_type });
};

/* ═══════════════════════════════════════
   自媒体拓客 (Social Media Lead Acquisition)
   ═══════════════════════════════════════ */

const PLATFORM_MAP = {
    douyin:       { label: '抖音',      icon: '🎵' },
    xiaohongshu:  { label: '小红书',    icon: '📕' },
    wechat_video: { label: '视频号',    icon: '🎬' },
};

const socialState = {
    activeTab: 'dashboard',
    kwPage: 1, kwPageSize: 20,
    postPage: 1, postPageSize: 20,
    postPlatform: '', postKeyword: '', postLeadFilter: '',
    taskPage: 1, taskPageSize: 20,
    taskPlatform: '', taskStatus: '',
};

window.switchSocialTab = function (tabId) {
    socialState.activeTab = tabId;
    navigate('social');
};

function platformBadge(platform) {
    const info = PLATFORM_MAP[platform] || { label: platform, icon: '❓' };
    return `<span class="platform-badge ${platform}">${info.icon} ${info.label}</span>`;
}

function statusBadge(status) {
    const labels = { pending: '待执行', running: '执行中', completed: '已完成', failed: '失败' };
    return `<span class="status-badge ${status}">${labels[status] || status}</span>`;
}

function scoreBadge(score) {
    const cls = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
    return `<span class="score-badge ${cls}">${score}</span>`;
}

// ─────────────────────────────────────────
// Main social page renderer
// ─────────────────────────────────────────
async function renderSocial(container) {
    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>🔍 自媒体拓客</h2>
                <p>社交媒体线索自动采集与管理 · ${currentCampus ? currentCampus.name : '全平台'}</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-primary" onclick="openCollectNowModal()">⚡ 一键采集</button>
            </div>
        </div>
        <div class="tabs">
            <div class="tab ${socialState.activeTab === 'dashboard' ? 'active' : ''}" onclick="switchSocialTab('dashboard')">📊 数据概览</div>
            <div class="tab ${socialState.activeTab === 'keywords' ? 'active' : ''}" onclick="switchSocialTab('keywords')">🔑 关键词配置</div>
            <div class="tab ${socialState.activeTab === 'posts' ? 'active' : ''}" onclick="switchSocialTab('posts')">📝 采集结果</div>
            <div class="tab ${socialState.activeTab === 'tasks' ? 'active' : ''}" onclick="switchSocialTab('tasks')">📋 任务记录</div>
        </div>
        <div id="socialTabContent"></div>
    `;
    showLoader(true);
    try {
        const tc = $('#socialTabContent');
        switch (socialState.activeTab) {
            case 'dashboard': await renderSocialDashboard(tc); break;
            case 'keywords':  await renderSocialKeywords(tc);  break;
            case 'posts':     await renderSocialPosts(tc);     break;
            case 'tasks':     await renderSocialTasks(tc);     break;
        }
    } catch (err) {
        console.error('Social render error:', err);
        $('#socialTabContent').innerHTML = `<div class="empty-state"><p>⚠️ 加载失败：${err.message}</p></div>`;
    } finally {
        showLoader(false);
    }
}

// ─────────────────────────────────────────
// Dashboard — 数据概览
// ─────────────────────────────────────────
async function renderSocialDashboard(tc) {
    const [tasksRes, kwRes] = await Promise.all([
        apiGet('/api/social/tasks?page=1&page_size=5'),
        apiGet('/api/social/keywords?page=1&page_size=100'),
    ]);
    const tasks = tasksRes.items || [];
    const keywords = kwRes.items || [];

    const platforms = ['douyin', 'xiaohongshu', 'wechat_video'];
    const platformStats = platforms.map(p => {
        const kwForPlatform = keywords.filter(k => k.platform === p);
        const activeKws = kwForPlatform.filter(k => k.is_active).length;
        const platformTasks = tasks.filter(t => t.platform === p);
        const completed = platformTasks.filter(t => t.status === 'completed');
        const totalPosts  = completed.reduce((s, t) => s + (t.total_found || 0), 0);
        const totalLeads  = completed.reduce((s, t) => s + (t.leads_created || 0), 0);
        const lastTask    = platformTasks.length > 0 ? platformTasks[0] : null;
        return { platform: p, totalKws: kwForPlatform.length, activeKws,
                 totalTasks: platformTasks.length, totalPosts, totalLeads, lastTask };
    });

    tc.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${keywords.length}</div><div class="stat-label">关键词策略</div></div>
            <div class="stat-card info"><div class="stat-value">${tasks.length}</div><div class="stat-label">采集任务</div></div>
            <div class="stat-card success"><div class="stat-value">${tasks.reduce((s,t) => s + (t.total_found || 0), 0)}</div><div class="stat-label">采集帖子</div></div>
            <div class="stat-card warning"><div class="stat-value">${tasks.reduce((s,t) => s + (t.leads_created || 0), 0)}</div><div class="stat-label">生成线索</div></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
            ${platformStats.map(ps => `
                <div class="card">
                    <div class="card-header"><h3>${platformBadge(ps.platform)}</h3></div>
                    <div style="padding:12px 16px;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
                            <div><span style="color:var(--gray-400)">关键词</span><br><strong>${ps.totalKws}</strong> (活跃 ${ps.activeKws})</div>
                            <div><span style="color:var(--gray-400)">任务</span><br><strong>${ps.totalTasks}</strong></div>
                            <div><span style="color:var(--gray-400)">帖子</span><br><strong>${ps.totalPosts}</strong></div>
                            <div><span style="color:var(--gray-400)">线索</span><br><strong>${ps.totalLeads}</strong></div>
                        </div>
                        ${ps.lastTask ? `
                            <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--gray-100);font-size:12px;color:var(--gray-400);">
                                上次: ${new Date(ps.lastTask.created_at).toLocaleString()}
                                ${ps.lastTask.status === 'completed' ? '✅' : ps.lastTask.status === 'running' ? '🔄' : '❌'}
                            </div>
                        ` : '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--gray-100);font-size:12px;color:var(--gray-400);">暂无采集记录</div>'}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="card">
            <div class="card-header">
                <h3>📋 最近采集任务</h3>
                <a href="#" onclick="switchSocialTab('tasks');return false;" style="font-size:13px;color:var(--primary);">查看全部 →</a>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th>平台</th><th>关键词</th><th>状态</th><th>发现帖子</th><th>生成线索</th><th>时间</th></tr></thead>
                    <tbody>
                        ${tasks.length === 0 ? '<tr><td colspan="6" class="text-center" style="color:var(--gray-400);">暂无任务记录</td></tr>' :
                        tasks.map(t => `
                            <tr>
                                <td>${platformBadge(t.platform)}</td>
                                <td>${t.keyword_config?.name || '—'}</td>
                                <td>${statusBadge(t.status)}</td>
                                <td>${t.total_found || 0}</td>
                                <td>${t.leads_created || 0}</td>
                                <td style="font-size:12px;color:var(--gray-400);">${new Date(t.created_at).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ─────────────────────────────────────────
// Keywords — 关键词配置管理
// ─────────────────────────────────────────
async function renderSocialKeywords(tc) {
    const data = await apiGet(`/api/social/keywords?page=${socialState.kwPage}&page_size=${socialState.kwPageSize}`);
    const items = data.items || [];

    tc.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="font-size:14px;color:var(--gray-500);">共 ${data.total} 个关键词配置</div>
            <button class="btn btn-primary" onclick="openSocialKeywordModal()">+ 新增配置</button>
        </div>
        <div class="table-container">
            <table>
                <thead><tr><th>平台</th><th>名称</th><th>关键词</th><th>间隔</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
                <tbody>
                    ${items.length === 0 ? '<tr><td colspan="7" class="text-center" style="color:var(--gray-400);">暂无配置</td></tr>' :
                    items.map(kw => `
                        <tr>
                            <td>${platformBadge(kw.platform)}</td>
                            <td><strong>${kw.name}</strong></td>
                            <td>${(kw.keywords || []).map(k => `<span class="keyword-tag">${k}</span>`).join(' ')}</td>
                            <td>${kw.search_interval_hours}h</td>
                            <td>
                                <label class="toggle-switch">
                                    <input type="checkbox" ${kw.is_active ? 'checked' : ''} onchange="toggleSocialKeyword(${kw.id}, this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </td>
                            <td style="font-size:12px;color:var(--gray-400);">${new Date(kw.created_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-sm" onclick="openSocialKeywordModal(${kw.id})" title="编辑">✏️</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteSocialKeyword(${kw.id})" title="删除">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${renderPagination(socialState.kwPage, data.total, socialState.kwPageSize, 'switchSocialKwPage')}
    `;
}

window.switchSocialKwPage = function (page) {
    socialState.kwPage = page;
    navigate('social');
};

// ─────────────────────────────────────────
// Posts — 采集结果浏览
// ─────────────────────────────────────────
async function renderSocialPosts(tc) {
    let query = `/api/social/posts?page=${socialState.postPage}&page_size=${socialState.postPageSize}`;
    if (socialState.postPlatform)   query += `&platform=${socialState.postPlatform}`;
    if (socialState.postKeyword)    query += `&keyword=${encodeURIComponent(socialState.postKeyword)}`;
    if (socialState.postLeadFilter) query += `&is_lead_generated=${socialState.postLeadFilter}`;

    const data = await apiGet(query);
    const items = data.items || [];

    tc.innerHTML = `
        <div class="search-bar" style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;">
            <select id="postPlatformFilter" onchange="socialFilterPosts()">
                <option value="">全部平台</option>
                <option value="douyin"       ${socialState.postPlatform === 'douyin'       ? 'selected' : ''}>🎵 抖音</option>
                <option value="xiaohongshu"  ${socialState.postPlatform === 'xiaohongshu'  ? 'selected' : ''}>📕 小红书</option>
                <option value="wechat_video" ${socialState.postPlatform === 'wechat_video' ? 'selected' : ''}>🎬 视频号</option>
            </select>
            <input type="text" placeholder="搜索关键词..." value="${socialState.postKeyword}"
                   id="postKeywordInput" onkeydown="if(event.key==='Enter')socialFilterPosts()">
            <select id="postLeadFilter" onchange="socialFilterPosts()">
                <option value="">全部状态</option>
                <option value="true"  ${socialState.postLeadFilter === 'true'  ? 'selected' : ''}>已转线索</option>
                <option value="false" ${socialState.postLeadFilter === 'false' ? 'selected' : ''}>未转线索</option>
            </select>
            <button class="btn btn-sm" onclick="socialFilterPosts()">🔍 搜索</button>
            <button class="btn btn-sm" onclick="socialFilterPosts(true)">🔄 重置</button>
        </div>
        <div style="font-size:13px;color:var(--gray-400);margin-bottom:10px;">共 ${data.total} 条采集结果</div>
        <div id="postList">
            ${items.length === 0 ? '<div class="empty-state"><p>暂无采集结果</p></div>' :
            items.map(p => `
                <div class="post-card">
                    <div class="post-meta">
                        ${platformBadge(p.platform)}
                        <span>👤 ${p.author_name || '未知'}</span>
                        <span>👍 ${p.like_count || 0} · 💬 ${p.comment_count || 0} · 🔄 ${p.share_count || 0}</span>
                        <span>📅 ${new Date(p.posted_at || p.created_at).toLocaleString()}</span>
                        ${p.is_lead_generated
                            ? '<span class="status-badge completed">已转线索</span>'
                            : '<span class="status-badge pending">待处理</span>'}
                    </div>
                    <div class="post-title">${(p.title || '').substring(0, 100) || '（无标题）'}</div>
                    ${p.content ? `<div class="post-snippet">${p.content.substring(0, 200)}${p.content.length > 200 ? '...' : ''}</div>` : ''}
                    <div class="post-actions">
                        ${!p.is_lead_generated
                            ? `<button class="btn btn-sm btn-success" onclick="generateLeadFromPost(${p.id})">✨ 转为线索</button>`
                            : '<span style="font-size:12px;color:var(--gray-400);">✅ 线索已生成</span>'}
                        ${p.source_keywords ? `<span style="font-size:12px;color:var(--gray-400);">🔑 ${p.source_keywords}</span>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        ${renderPagination(socialState.postPage, data.total, socialState.postPageSize, 'switchSocialPostPage')}
    `;
}

window.switchSocialPostPage = function (page) {
    socialState.postPage = page;
    navigate('social');
};

window.socialFilterPosts = function (reset) {
    if (reset) {
        socialState.postPlatform = '';
        socialState.postKeyword  = '';
        socialState.postLeadFilter = '';
    } else {
        socialState.postPlatform   = $('#postPlatformFilter')?.value || '';
        socialState.postKeyword    = $('#postKeywordInput')?.value || '';
        socialState.postLeadFilter = $('#postLeadFilter')?.value || '';
    }
    socialState.postPage = 1;
    navigate('social');
};

// ─────────────────────────────────────────
// Tasks — 采集任务记录
// ─────────────────────────────────────────
async function renderSocialTasks(tc) {
    let query = `/api/social/tasks?page=${socialState.taskPage}&page_size=${socialState.taskPageSize}`;
    if (socialState.taskPlatform) query += `&platform=${socialState.taskPlatform}`;
    if (socialState.taskStatus)   query += `&status=${socialState.taskStatus}`;

    const data = await apiGet(query);
    const items = data.items || [];

    tc.innerHTML = `
        <div class="search-bar" style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;">
            <select id="taskPlatformFilter" onchange="socialFilterTasks()">
                <option value="">全部平台</option>
                <option value="douyin"       ${socialState.taskPlatform === 'douyin'       ? 'selected' : ''}>🎵 抖音</option>
                <option value="xiaohongshu"  ${socialState.taskPlatform === 'xiaohongshu'  ? 'selected' : ''}>📕 小红书</option>
                <option value="wechat_video" ${socialState.taskPlatform === 'wechat_video' ? 'selected' : ''}>🎬 视频号</option>
            </select>
            <select id="taskStatusFilter" onchange="socialFilterTasks()">
                <option value="">全部状态</option>
                <option value="pending"   ${socialState.taskStatus === 'pending'   ? 'selected' : ''}>待执行</option>
                <option value="running"   ${socialState.taskStatus === 'running'   ? 'selected' : ''}>执行中</option>
                <option value="completed" ${socialState.taskStatus === 'completed' ? 'selected' : ''}>已完成</option>
                <option value="failed"    ${socialState.taskStatus === 'failed'    ? 'selected' : ''}>失败</option>
            </select>
            <button class="btn btn-sm" onclick="socialFilterTasks()">🔍 筛选</button>
            <button class="btn btn-sm" onclick="socialFilterTasks(true)">🔄 刷新</button>
        </div>
        <div style="font-size:13px;color:var(--gray-400);margin-bottom:10px;">共 ${data.total} 条任务记录</div>
        <div class="table-container">
            <table>
                <thead><tr><th>平台</th><th>关键词配置</th><th>状态</th><th>发现帖子</th><th>生成线索</th><th>开始时间</th><th>完成时间</th><th>操作</th></tr></thead>
                <tbody>
                    ${items.length === 0 ? '<tr><td colspan="8" class="text-center" style="color:var(--gray-400);">暂无任务记录</td></tr>' :
                    items.map(t => `
                        <tr>
                            <td>${platformBadge(t.platform)}</td>
                            <td>${t.keyword_config?.name || '—'}</td>
                            <td>${statusBadge(t.status)}</td>
                            <td>${t.total_found || 0}</td>
                            <td>${t.leads_created || 0}</td>
                            <td style="font-size:12px;color:var(--gray-400);">${t.started_at ? new Date(t.started_at).toLocaleString() : '—'}</td>
                            <td style="font-size:12px;color:var(--gray-400);">${t.completed_at ? new Date(t.completed_at).toLocaleString() : '—'}</td>
                            <td>
                                ${t.status !== 'running'
                                    ? `<button class="btn btn-sm" onclick="executeSocialTask(${t.id})">▶ 执行</button>`
                                    : '<span style="font-size:12px;color:var(--gray-400);">执行中…</span>'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${renderPagination(socialState.taskPage, data.total, socialState.taskPageSize, 'switchSocialTaskPage')}
    `;
}

window.switchSocialTaskPage = function (page) {
    socialState.taskPage = page;
    navigate('social');
};

window.socialFilterTasks = function (reset) {
    if (reset) {
        socialState.taskPlatform = '';
        socialState.taskStatus   = '';
    } else {
        socialState.taskPlatform = $('#taskPlatformFilter')?.value || '';
        socialState.taskStatus   = $('#taskStatusFilter')?.value || '';
    }
    socialState.taskPage = 1;
    navigate('social');
};

// ════════════════════════════════════════════
// Social: Modal Actions
// ════════════════════════════════════════════

// ── 一键采集 ──
window.openCollectNowModal = function () {
    const platforms = [
        { value: 'douyin',       label: '🎵 抖音' },
        { value: 'xiaohongshu',  label: '📕 小红书' },
        { value: 'wechat_video', label: '🎬 视频号' },
    ];
    openModal('⚡ 一键采集', `
        <form id="collectNowForm">
            <div class="form-group">
                <label>选择平台</label>
                <select id="collectPlatform" required>
                    <option value="">— 请选择 —</option>
                    ${platforms.map(p => `<option value="${p.value}">${p.label}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>搜索关键词 <span style="color:var(--gray-400);font-weight:400;">（多个用逗号分隔）</span></label>
                <textarea id="collectKeywords" rows="3" placeholder="例如: 英语培训, 单词速记, 少儿英语" required style="resize:vertical;"></textarea>
            </div>
            <div class="form-group">
                <label>采集名称 <span style="color:var(--gray-400);font-weight:400;">（可选）</span></label>
                <input type="text" id="collectName" value="手动采集" placeholder="临时采集">
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;" id="collectNowBtn">🚀 开始采集</button>
        </form>
        <div id="collectResult" style="display:none;margin-top:16px;"></div>
    `);

    $('#collectNowForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const platform = $('#collectPlatform').value;
        const raw      = $('#collectKeywords').value.trim();
        const name     = $('#collectName').value.trim() || '手动采集';
        if (!platform || !raw) { showToast('请选择平台并输入关键词', 'warning'); return; }

        const btn = $('#collectNowBtn');
        btn.disabled = true;
        btn.textContent = '⏳ 采集中…';
        $('#collectResult').style.display = 'none';

        try {
            const res = await apiPost(
                `/api/social/collect-now?platform=${platform}&keywords=${encodeURIComponent(raw)}&name=${encodeURIComponent(name)}`
            );
            showToast(`采集完成！发现 ${res.total_found} 条，生成 ${res.leads_created} 条线索`, 'success');

            $('#collectResult').style.display = 'block';
            $('#collectResult').innerHTML = `
                <div class="card">
                    <div class="card-header"><h3>📊 采集结果</h3></div>
                    <div style="padding:12px 16px;">
                        <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin-bottom:12px;">
                            <div class="stat-card"><div class="stat-value">${res.total_found}</div><div class="stat-label">发现帖子</div></div>
                            <div class="stat-card success"><div class="stat-value">${res.leads_created}</div><div class="stat-label">生成线索</div></div>
                        </div>
                        ${(res.scored_posts || []).length > 0 ? `
                            <div style="font-weight:600;margin-bottom:8px;">评分详情（前20条）</div>
                            ${res.scored_posts.map(p => `
                                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--gray-100);font-size:13px;">
                                    <span>${p.author_name || '未知'} — ${(p.title || '').substring(0, 40)}</span>
                                    ${scoreBadge(p.score)}
                                </div>
                            `).join('')}
                        ` : '<p style="color:var(--gray-400);font-size:13px;">没有符合评分阈值的帖子</p>'}
                    </div>
                </div>
            `;
        } catch (err) {
            showToast('采集失败：' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '🚀 开始采集';
        }
    });
};

// ── 关键词配置 新增 / 编辑 ──
window.openSocialKeywordModal = async function (id) {
    let kw = null;
    if (id) {
        try {
            const data = await apiGet('/api/social/keywords?page=1&page_size=200');
            kw = (data.items || []).find(k => k.id === id);
        } catch (_) { /* ignore */ }
    }
    const isEdit = !!kw;
    const platformOpts = `
        <option value="">— 请选择 —</option>
        <option value="douyin"       ${kw?.platform === 'douyin'       ? 'selected' : ''}>🎵 抖音</option>
        <option value="xiaohongshu"  ${kw?.platform === 'xiaohongshu'  ? 'selected' : ''}>📕 小红书</option>
        <option value="wechat_video" ${kw?.platform === 'wechat_video' ? 'selected' : ''}>🎬 视频号</option>
    `;

    openModal(isEdit ? '✏️ 编辑关键词配置' : '➕ 新增关键词配置', `
        <form id="keywordForm">
            <div class="form-group">
                <label>平台</label>
                <select id="kwPlatform" required>${platformOpts}</select>
            </div>
            <div class="form-group">
                <label>配置名称</label>
                <input type="text" id="kwName" value="${kw ? kw.name : ''}" placeholder="例如: 英语培训关键词" required>
            </div>
            <div class="form-group">
                <label>关键词 <span style="color:var(--gray-400);font-weight:400;">（每行一个）</span></label>
                <textarea id="kwKeywords" rows="4" placeholder="英语培训&#10;单词速记&#10;少儿英语" required style="resize:vertical;">${kw ? (kw.keywords || []).join('\n') : ''}</textarea>
            </div>
            <div class="form-group">
                <label>匹配模式</label>
                <select id="kwMatchMode">
                    <option value="fuzzy" ${kw?.match_mode === 'fuzzy' ? 'selected' : ''}>模糊匹配</option>
                    <option value="exact" ${kw?.match_mode === 'exact' ? 'selected' : ''}>精确匹配</option>
                </select>
            </div>
            <div class="form-group">
                <label>采集间隔（小时）</label>
                <input type="number" id="kwInterval" value="${kw ? kw.search_interval_hours : 6}" min="1" max="168" required>
            </div>
            <div class="form-group" style="display:flex;align-items:center;gap:8px;">
                <label class="toggle-switch" style="margin:0;">
                    <input type="checkbox" id="kwActive" ${(!kw || kw.is_active) ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
                <span style="font-size:13px;color:var(--gray-600);">创建后立即启用定时采集</span>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;" id="kwSaveBtn">${isEdit ? '保存修改' : '创建配置'}</button>
        </form>
    `);

    $('#keywordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            platform:              $('#kwPlatform').value,
            name:                  $('#kwName').value.trim(),
            keywords:              $('#kwKeywords').value.split('\n').map(s => s.trim()).filter(Boolean),
            match_mode:            $('#kwMatchMode').value,
            search_interval_hours: parseInt($('#kwInterval').value) || 6,
            is_active:             $('#kwActive').checked,
        };
        if (!payload.platform || !payload.name || payload.keywords.length === 0) {
            showToast('请填写必要字段', 'warning'); return;
        }

        const btn = $('#kwSaveBtn');
        btn.disabled = true;
        btn.textContent = '保存中…';

        try {
            if (isEdit) {
                await apiPut(`/api/social/keywords/${id}`, payload);
                showToast('配置已更新', 'success');
            } else {
                await apiPost('/api/social/keywords', payload);
                showToast('配置已创建', 'success');
            }
            closeModal();
            navigate('social');
        } catch (err) {
            showToast('保存失败：' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = isEdit ? '保存修改' : '创建配置';
        }
    });
};

// ── 切换启用 / 禁用 ──
window.toggleSocialKeyword = async function (id, active) {
    try {
        await apiPut(`/api/social/keywords/${id}`, { is_active: active });
        showToast(active ? '定时采集已开启 ✅' : '定时采集已关闭', 'success');
    } catch (err) {
        showToast('操作失败：' + err.message, 'error');
        navigate('social');
    }
};

// ── 删除关键词配置 ──
window.deleteSocialKeyword = async function (id) {
    if (!confirm('确定要删除此关键词配置吗？\n（关联的定时任务也将取消）')) return;
    try {
        await apiDelete(`/api/social/keywords/${id}`);
        showToast('配置已删除', 'success');
        navigate('social');
    } catch (err) {
        showToast('删除失败：' + err.message, 'error');
    }
};

// ── 帖子转为线索 ──
window.generateLeadFromPost = async function (postId) {
    if (!confirm('确定要将此帖子转为线索吗？')) return;
    try {
        const res = await apiPost(`/api/social/posts/${postId}/generate-lead`);
        showToast('✅ 线索已生成（ID: ' + res.lead_id + '）', 'success');
        navigate('social');
    } catch (err) {
        showToast('转线索失败：' + err.message, 'error');
    }
};

// ── 重新执行采集任务 ──
window.executeSocialTask = async function (taskId) {
    if (!confirm('确定要重新执行此采集任务吗？')) return;
    try {
        const res = await apiPost(`/api/social/tasks/${taskId}/execute`);
        showToast(`✅ 执行完成 · 发现 ${res.total_found} 条 · 生成 ${res.leads_created} 条线索`, 'success');
        navigate('social');
    } catch (err) {
        showToast('执行失败：' + err.message, 'error');
    }
};

/* ═══════════════════════════════════════
   初始化
   ═══════════════════════════════════════ */

// ── 登录表单 ──
$('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = $('#loginPhone').value.trim();
    const code = $('#loginCode').value.trim();
    const errorEl = $('#loginError');
    const btn = $('#loginBtn');

    if (!/^1\d{10}$/.test(phone)) {
        errorEl.textContent = '请输入正确的11位手机号';
        return;
    }
    if (!code) {
        errorEl.textContent = '请输入验证码';
        return;
    }

    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '登录中...';

    try {
        await login(phone, code);
    } catch (err) {
        errorEl.textContent = err.message;
        btn.disabled = false;
        btn.textContent = '登 录';
    }
});

// ── 发送验证码 ──
$('#sendCodeBtn').addEventListener('click', async () => {
    const phone = $('#loginPhone').value.trim();
    if (!/^1\d{10}$/.test(phone)) {
        $('#loginError').textContent = '请输入正确的11位手机号';
        return;
    }
    $('#loginError').textContent = '';

    const btn = $('#sendCodeBtn');
    btn.disabled = true;
    btn.textContent = '发送中...';

    try {
        await apiPost('/api/auth/send-code', { phone });
        showToast('验证码已发送（开发模式：888888）', 'success');
        // 开始倒计时
        let seconds = 60;
        const timer = setInterval(() => {
            seconds--;
            btn.textContent = `${seconds}s`;
            if (seconds <= 0) {
                clearInterval(timer);
                btn.textContent = '重新获取';
                btn.disabled = false;
            }
        }, 1000);
    } catch (err) {
        btn.disabled = false;
        btn.textContent = '获取验证码';
        showToast('发送失败：' + err.message, 'error');
    }
});

// ── 启动应用 ──
document.addEventListener('DOMContentLoaded', () => {
    if (isLoggedIn()) {
        showApp();
        renderSidebar();

        // 从 URL hash 恢复页面
        const hash = location.hash.slice(1) || 'dashboard';
        navigate(hash);
    } else {
        showLogin();
    }
});

// ── PWA: 注册 Service Worker ──
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('SW registered:', reg.scope);
        }).catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}
