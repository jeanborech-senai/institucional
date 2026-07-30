// =============================================
// DASHBOARD — Feed, Filtros, Upload de Conteúdo
// =============================================

let currentUser = null;
let currentProfile = null;
let allCourses = [];
let allUCs = [];
let allContents = [];

// Filtros ativos
let filters = {
  course_id: '',
  uc_id: '',
  type: '',
  search: ''
};

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await requireAuth();
  if (!auth) return;

  currentUser = auth.session.user;
  currentProfile = auth.profile;

  initUserUI();
  await loadFiltersData();
  await loadContents();
  setupEventListeners();
});

// ── UI inicial ────────────────────────────────
function initUserUI() {
  document.getElementById('userName').textContent = currentProfile.full_name;
  document.getElementById('userRole').textContent =
    currentProfile.role === 'admin' ? 'Administrador' : 'Professor';

  if (currentProfile.role === 'admin') {
    document.getElementById('adminLink').style.display = 'inline-flex';
  }
}

// ── Carrega cursos e UCs para os filtros ──────
async function loadFiltersData() {
  const [{ data: courses }, { data: ucs }] = await Promise.all([
    sb.from('courses').select('*').eq('active', true).order('name'),
    sb.from('curricular_units').select('*, courses(name)').order('name'),
  ]);

  allCourses = courses || [];
  allUCs = ucs || [];

  populateCourseSelect('filterCourse', true);
  populateCourseSelect('uploadCourse', false);
}

function populateCourseSelect(selectId, withAll) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = withAll ? '<option value="">Todos os cursos</option>' : '<option value="">Selecione o curso</option>';
  allCourses.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
}

function populateUCSelect(selectId, courseId, withAll) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const filtered = courseId ? allUCs.filter(u => u.course_id === courseId) : allUCs;
  sel.innerHTML = withAll ? '<option value="">Todas as UCs</option>' : '<option value="">Selecione a UC</option>';
  filtered.forEach(u => {
    sel.innerHTML += `<option value="${u.id}">${u.name}</option>`;
  });
}

// ── Carrega conteúdos ─────────────────────────
async function loadContents() {
  showFeedLoading(true);

  let query = sb
    .from('contents')
    .select(`
      *,
      profiles (full_name),
      courses (name),
      curricular_units (name)
    `)
    .order('published_at', { ascending: false });

  if (filters.course_id) query = query.eq('course_id', filters.course_id);
  if (filters.uc_id) query = query.eq('uc_id', filters.uc_id);
  if (filters.type) query = query.eq('content_type', filters.type);
  if (filters.search) query = query.ilike('title', `%${filters.search}%`);

  const { data, error } = await query;

  showFeedLoading(false);

  if (error) {
    document.getElementById('feed').innerHTML = `<p class="feed-empty">Erro ao carregar conteúdos.</p>`;
    return;
  }

  allContents = data || [];
  renderFeed();
}

function renderFeed() {
  const feed = document.getElementById('feed');
  const count = document.getElementById('contentCount');

  if (allContents.length === 0) {
    feed.innerHTML = `<div class="feed-empty">
      <span class="feed-empty-icon">📭</span>
      <p>Nenhum conteúdo encontrado.</p>
      <p>Seja o primeiro a publicar algo!</p>
    </div>`;
    count.textContent = '0 resultados';
    return;
  }

  count.textContent = `${allContents.length} ${allContents.length === 1 ? 'resultado' : 'resultados'}`;
  feed.innerHTML = allContents.map(renderCard).join('');

  // Botões de ação nos cards
  feed.querySelectorAll('.card-download').forEach(btn => {
    btn.addEventListener('click', () => openContent(btn.dataset.url, btn.dataset.title));
  });

  feed.querySelectorAll('.card-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteContent(btn.dataset.id, btn.dataset.filepath));
  });
}

function renderCard(item) {
  const typeInfo = CONTENT_TYPES.find(t => t.value === item.content_type) || { label: item.content_type, icon: '📁' };
  const date = new Date(item.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const competencies = Array.isArray(item.competencies) ? item.competencies : [];
  const canDelete = currentProfile.role === 'admin' || item.professor_id === currentUser.id;

  return `
    <article class="content-card type-${item.content_type}">
      <div class="card-header">
        <span class="card-type-badge">${typeInfo.icon} ${typeInfo.label}</span>
        <div class="card-actions">
          ${item.file_url ? `<button class="card-download" data-url="${item.file_url}" data-title="${item.title}" title="Abrir / Baixar">⬇️ Baixar</button>` : ''}
          ${canDelete ? `<button class="card-delete" data-id="${item.id}" data-filepath="${item.file_path || ''}" title="Excluir">🗑️</button>` : ''}
        </div>
      </div>

      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      ${item.description ? `<p class="card-description">${escapeHtml(item.description)}</p>` : ''}

      <div class="card-meta">
        <span class="meta-tag course-tag">📚 ${item.courses?.name || '—'}</span>
        <span class="meta-tag uc-tag">🎯 ${item.curricular_units?.name || '—'}</span>
      </div>

      ${competencies.length > 0 ? `
        <div class="card-competencies">
          ${competencies.map(c => `<span class="competency-tag">${escapeHtml(c)}</span>`).join('')}
        </div>` : ''}

      <div class="card-footer">
        <span class="card-author">👤 ${item.profiles?.full_name || 'Desconhecido'}</span>
        <span class="card-date">📅 ${date}</span>
      </div>
    </article>
  `;
}

function openContent(url, title) {
  window.open(url, '_blank');
}

async function deleteContent(id, filePath) {
  if (!confirm('Deseja excluir este conteúdo permanentemente?')) return;

  try {
    if (filePath) {
      await sb.storage.from(STORAGE_BUCKET).remove([filePath]);
    }
    const { error } = await sb.from('contents').delete().eq('id', id);
    if (error) throw error;
    showToast('Conteúdo excluído com sucesso.', 'success');
    await loadContents();
  } catch (err) {
    showToast('Erro ao excluir: ' + err.message, 'error');
  }
}

function showFeedLoading(show) {
  document.getElementById('feedLoading').style.display = show ? 'flex' : 'none';
  document.getElementById('feed').style.display = show ? 'none' : 'grid';
}

// ── Event Listeners ───────────────────────────
function setupEventListeners() {
  // Filtros
  document.getElementById('filterCourse').addEventListener('change', (e) => {
    filters.course_id = e.target.value;
    filters.uc_id = '';
    populateUCSelect('filterUC', e.target.value, true);
    document.getElementById('filterUC').value = '';
    loadContents();
  });

  document.getElementById('filterUC').addEventListener('change', (e) => {
    filters.uc_id = e.target.value;
    loadContents();
  });

  document.getElementById('filterType').addEventListener('change', (e) => {
    filters.type = e.target.value;
    loadContents();
  });

  let searchTimeout;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filters.search = e.target.value.trim();
      loadContents();
    }, 400);
  });

  document.getElementById('clearFilters').addEventListener('click', () => {
    filters = { course_id: '', uc_id: '', type: '', search: '' };
    document.getElementById('filterCourse').value = '';
    document.getElementById('filterUC').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('searchInput').value = '';
    populateUCSelect('filterUC', '', true);
    loadContents();
  });

  // Upload: curso → popula UCs
  document.getElementById('uploadCourse').addEventListener('change', (e) => {
    populateUCSelect('uploadUC', e.target.value, false);
    document.getElementById('uploadUC').value = '';
  });

  // Adicionar competência
  document.getElementById('addCompetency').addEventListener('click', addCompetencyTag);
  document.getElementById('competencyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCompetencyTag(); }
  });

  // Upload: tipo vídeo mostra campo de link
  document.getElementById('uploadType').addEventListener('change', (e) => {
    const isVideo = e.target.value === 'video';
    document.getElementById('fileSection').style.display = isVideo ? 'none' : 'block';
    document.getElementById('videoLinkSection').style.display = isVideo ? 'block' : 'none';
  });

  // Submit upload
  document.getElementById('uploadForm').addEventListener('submit', handleUpload);

  // Modal
  document.getElementById('openUploadModal').addEventListener('click', () => {
    document.getElementById('uploadModal').classList.add('open');
  });
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelUpload').addEventListener('click', closeModal);
  document.getElementById('uploadModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.href = 'index.html';
  });

  // Drag-drop na área de upload
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) setUploadFile(file);
    });
    dropzone.addEventListener('click', () => document.getElementById('uploadFile').click());
    document.getElementById('uploadFile').addEventListener('change', (e) => {
      if (e.target.files[0]) setUploadFile(e.target.files[0]);
    });
  }
}

function closeModal() {
  document.getElementById('uploadModal').classList.remove('open');
  document.getElementById('uploadForm').reset();
  document.getElementById('competencyTags').innerHTML = '';
  document.getElementById('fileLabel').textContent = 'Clique ou arraste o arquivo aqui';
  document.getElementById('fileSection').style.display = 'block';
  document.getElementById('videoLinkSection').style.display = 'none';
  populateUCSelect('uploadUC', '', false);
}

function setUploadFile(file) {
  document.getElementById('fileLabel').textContent = `📎 ${file.name} (${formatFileSize(file.size)})`;
  // Atualiza o input file
  const dt = new DataTransfer();
  dt.items.add(file);
  document.getElementById('uploadFile').files = dt.files;
}

// ── Competências ──────────────────────────────
const competencyList = [];

function addCompetencyTag() {
  const input = document.getElementById('competencyInput');
  const val = input.value.trim();
  if (!val || competencyList.includes(val)) { input.value = ''; return; }

  competencyList.push(val);
  const tag = document.createElement('span');
  tag.className = 'competency-tag removable';
  tag.innerHTML = `${escapeHtml(val)} <button onclick="removeCompetency('${escapeHtml(val)}', this)">×</button>`;
  document.getElementById('competencyTags').appendChild(tag);
  input.value = '';
}

function removeCompetency(val, btn) {
  const idx = competencyList.indexOf(val);
  if (idx > -1) competencyList.splice(idx, 1);
  btn.parentElement.remove();
}

// ── Upload de conteúdo ────────────────────────
async function handleUpload(e) {
  e.preventDefault();

  const title = document.getElementById('uploadTitle').value.trim();
  const description = document.getElementById('uploadDescription').value.trim();
  const courseId = document.getElementById('uploadCourse').value;
  const ucId = document.getElementById('uploadUC').value;
  const contentType = document.getElementById('uploadType').value;
  const videoLink = document.getElementById('videoLink').value.trim();
  const file = document.getElementById('uploadFile').files[0];
  const btn = e.target.querySelector('button[type="submit"]');

  // Validações
  if (!title) { showToast('Digite um título.', 'error'); return; }
  if (!courseId) { showToast('Selecione o curso.', 'error'); return; }
  if (!ucId) { showToast('Selecione a Unidade Curricular.', 'error'); return; }
  if (!contentType) { showToast('Selecione o tipo de conteúdo.', 'error'); return; }
  if (contentType === 'video' && !videoLink) { showToast('Cole o link do vídeo.', 'error'); return; }
  if (contentType !== 'video' && !file) { showToast('Selecione um arquivo.', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Publicando...';

  try {
    let fileUrl = videoLink || null;
    let filePath = null;

    if (file) {
      const ext = file.name.split('.').pop();
      filePath = `${currentUser.id}/${Date.now()}_${title.replace(/[^a-z0-9]/gi, '_')}.${ext}`;

      const { error: uploadError } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
      fileUrl = urlData.publicUrl;
    }

    const { error } = await sb.from('contents').insert({
      professor_id: currentUser.id,
      course_id: courseId,
      uc_id: ucId,
      title,
      description,
      content_type: contentType,
      file_url: fileUrl,
      file_path: filePath,
      competencies: [...competencyList],
      published_at: new Date().toISOString(),
    });

    if (error) throw error;

    closeModal();
    showToast('✅ Conteúdo publicado com sucesso!', 'success');
    await loadContents();
  } catch (err) {
    showToast('Erro ao publicar: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publicar';
  }
}

// ── Utilitários ───────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Popula tipo de conteúdo no select do upload
document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('uploadType');
  if (sel) {
    sel.innerHTML = '<option value="">Tipo de conteúdo</option>' +
      CONTENT_TYPES.map(t => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('');
  }

  const filterType = document.getElementById('filterType');
  if (filterType) {
    filterType.innerHTML = '<option value="">Todos os tipos</option>' +
      CONTENT_TYPES.map(t => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('');
  }
});
