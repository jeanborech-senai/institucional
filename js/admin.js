// =============================================
// ADMIN — Gerenciar Cursos, UCs, Usuários
// =============================================

let adminProfile = null;
let editingCourseId = null;
let editingUCId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await requireAuth(true);
  if (!auth) return;

  adminProfile = auth.profile;
  document.getElementById('adminName').textContent = adminProfile.full_name;

  setupAdminTabs();
  await Promise.all([loadCourses(), loadUCs(), loadUsers(), loadStats()]);
  setupAdminEvents();
});

// ── Tabs do admin ─────────────────────────────
function setupAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const panels = document.querySelectorAll('.admin-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });
}

// ── Estatísticas ──────────────────────────────
async function loadStats() {
  const [
    { count: contentCount },
    { count: userCount },
    { count: courseCount },
  ] = await Promise.all([
    sb.from('contents').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('courses').select('*', { count: 'exact', head: true }),
  ]);

  document.getElementById('statContents').textContent = contentCount || 0;
  document.getElementById('statUsers').textContent = userCount || 0;
  document.getElementById('statCourses').textContent = courseCount || 0;
}

// ── Cursos ────────────────────────────────────
async function loadCourses() {
  const { data, error } = await sb
    .from('courses')
    .select('*, curricular_units(count)')
    .order('name');

  if (error) { console.error(error); return; }

  const tbody = document.getElementById('coursesTable');
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Nenhum curso cadastrado.</td></tr>';
    return;
  }

  data.forEach(course => {
    const ucCount = course.curricular_units?.[0]?.count || 0;
    tbody.innerHTML += `
      <tr>
        <td><strong>${escHtml(course.name)}</strong></td>
        <td><code>${escHtml(course.abbreviation || '—')}</code></td>
        <td>
          <span class="status-badge ${course.active ? 'active' : 'inactive'}">
            ${course.active ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td class="table-actions">
          <button class="btn-sm btn-edit" onclick="openEditCourse('${course.id}', '${escHtml(course.name)}', '${escHtml(course.abbreviation || '')}', ${course.active})">✏️ Editar</button>
          <button class="btn-sm btn-toggle" onclick="toggleCourse('${course.id}', ${course.active})">${course.active ? '⏸️ Desativar' : '▶️ Ativar'}</button>
        </td>
      </tr>`;
  });
}

async function saveCourse() {
  const name = document.getElementById('courseName').value.trim();
  const abbreviation = document.getElementById('courseAbbr').value.trim().toUpperCase();
  const active = document.getElementById('courseActive').checked;

  if (!name) { adminToast('Digite o nome do curso.', 'error'); return; }

  try {
    if (editingCourseId) {
      const { error } = await sb.from('courses').update({ name, abbreviation, active }).eq('id', editingCourseId);
      if (error) throw error;
      adminToast('Curso atualizado!', 'success');
    } else {
      const { error } = await sb.from('courses').insert({ name, abbreviation, active });
      if (error) throw error;
      adminToast('Curso cadastrado!', 'success');
    }
    clearCourseForm();
    await loadCourses();
    await loadStats();
  } catch (err) {
    adminToast('Erro: ' + err.message, 'error');
  }
}

function openEditCourse(id, name, abbr, active) {
  editingCourseId = id;
  document.getElementById('courseName').value = name;
  document.getElementById('courseAbbr').value = abbr;
  document.getElementById('courseActive').checked = active;
  document.getElementById('courseFormTitle').textContent = 'Editar Curso';
  document.getElementById('cancelCourseEdit').style.display = 'inline-block';
  document.getElementById('courseName').focus();
}

function clearCourseForm() {
  editingCourseId = null;
  document.getElementById('courseForm').reset();
  document.getElementById('courseActive').checked = true;
  document.getElementById('courseFormTitle').textContent = 'Novo Curso';
  document.getElementById('cancelCourseEdit').style.display = 'none';
}

async function toggleCourse(id, currentActive) {
  const { error } = await sb.from('courses').update({ active: !currentActive }).eq('id', id);
  if (error) { adminToast('Erro ao atualizar.', 'error'); return; }
  adminToast('Status atualizado!', 'success');
  await loadCourses();
}

// ── Unidades Curriculares ─────────────────────
async function loadUCs() {
  const { data: courses } = await sb.from('courses').select('id, name').order('name');
  const { data: ucs } = await sb.from('curricular_units').select('*, courses(name)').order('name');

  // Popula select de curso no form de UC
  const sel = document.getElementById('ucCourse');
  sel.innerHTML = '<option value="">Selecione o curso</option>';
  (courses || []).forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${escHtml(c.name)}</option>`;
  });

  const tbody = document.getElementById('ucsTable');
  tbody.innerHTML = '';

  if (!ucs || ucs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Nenhuma UC cadastrada.</td></tr>';
    return;
  }

  ucs.forEach(uc => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${escHtml(uc.name)}</strong></td>
        <td>${escHtml(uc.courses?.name || '—')}</td>
        <td><code>${escHtml(uc.abbreviation || '—')}</code></td>
        <td class="table-actions">
          <button class="btn-sm btn-edit" onclick="openEditUC('${uc.id}', '${escHtml(uc.name)}', '${uc.course_id}', '${escHtml(uc.abbreviation || '')}')">✏️ Editar</button>
          <button class="btn-sm btn-danger" onclick="deleteUC('${uc.id}')">🗑️ Excluir</button>
        </td>
      </tr>`;
  });
}

async function saveUC() {
  const name = document.getElementById('ucName').value.trim();
  const courseId = document.getElementById('ucCourse').value;
  const abbreviation = document.getElementById('ucAbbr').value.trim().toUpperCase();

  if (!name) { adminToast('Digite o nome da UC.', 'error'); return; }
  if (!courseId) { adminToast('Selecione o curso.', 'error'); return; }

  try {
    if (editingUCId) {
      const { error } = await sb.from('curricular_units').update({ name, course_id: courseId, abbreviation }).eq('id', editingUCId);
      if (error) throw error;
      adminToast('UC atualizada!', 'success');
    } else {
      const { error } = await sb.from('curricular_units').insert({ name, course_id: courseId, abbreviation });
      if (error) throw error;
      adminToast('UC cadastrada!', 'success');
    }
    clearUCForm();
    await loadUCs();
  } catch (err) {
    adminToast('Erro: ' + err.message, 'error');
  }
}

function openEditUC(id, name, courseId, abbr) {
  editingUCId = id;
  document.getElementById('ucName').value = name;
  document.getElementById('ucCourse').value = courseId;
  document.getElementById('ucAbbr').value = abbr;
  document.getElementById('ucFormTitle').textContent = 'Editar UC';
  document.getElementById('cancelUCEdit').style.display = 'inline-block';
  document.getElementById('ucName').focus();
}

function clearUCForm() {
  editingUCId = null;
  document.getElementById('ucForm').reset();
  document.getElementById('ucFormTitle').textContent = 'Nova Unidade Curricular';
  document.getElementById('cancelUCEdit').style.display = 'none';
}

async function deleteUC(id) {
  if (!confirm('Excluir esta UC? Os conteúdos vinculados não serão excluídos.')) return;
  const { error } = await sb.from('curricular_units').delete().eq('id', id);
  if (error) { adminToast('Erro: ' + err.message, 'error'); return; }
  adminToast('UC excluída.', 'success');
  await loadUCs();
}

// ── Usuários ──────────────────────────────────
async function loadUsers() {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('full_name');

  const tbody = document.getElementById('usersTable');
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Nenhum usuário cadastrado.</td></tr>';
    return;
  }

  data.forEach(user => {
    const isAdmin = user.role === 'admin';
    tbody.innerHTML += `
      <tr>
        <td><strong>${escHtml(user.full_name)}</strong></td>
        <td>${escHtml(user.email)}</td>
        <td>
          <span class="status-badge ${isAdmin ? 'admin-badge' : 'prof-badge'}">
            ${isAdmin ? '🔑 Admin' : '👨‍🏫 Professor'}
          </span>
        </td>
        <td class="table-actions">
          ${user.id !== adminProfile.id ? `
            <button class="btn-sm ${isAdmin ? 'btn-toggle' : 'btn-edit'}" onclick="toggleUserRole('${user.id}', '${user.role}')">
              ${isAdmin ? '⬇️ Rebaixar' : '⬆️ Tornar Admin'}
            </button>
          ` : '<span class="self-label">Você</span>'}
        </td>
      </tr>`;
  });
}

async function toggleUserRole(userId, currentRole) {
  const newRole = currentRole === 'admin' ? 'professor' : 'admin';
  const confirm_msg = newRole === 'admin'
    ? 'Tornar este usuário administrador? Ele terá acesso total ao painel admin.'
    : 'Remover privilégios de admin deste usuário?';

  if (!confirm(confirm_msg)) return;

  const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', userId);
  if (error) { adminToast('Erro: ' + error.message, 'error'); return; }
  adminToast('Papel atualizado!', 'success');
  await loadUsers();
  await loadStats();
}

// ── Events ────────────────────────────────────
function setupAdminEvents() {
  document.getElementById('saveCourse').addEventListener('click', saveCourse);
  document.getElementById('cancelCourseEdit').addEventListener('click', clearCourseForm);
  document.getElementById('saveUC').addEventListener('click', saveUC);
  document.getElementById('cancelUCEdit').addEventListener('click', clearUCForm);

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.href = 'index.html';
  });
}

// ── Utilitários ───────────────────────────────
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function adminToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}
