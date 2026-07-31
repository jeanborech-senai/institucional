// =============================================
// AUTH — Login, Cadastro, Logout
// =============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Se já está logado, vai direto pro dashboard
  const session = await getSession();
  if (session) {
    window.location.href = 'dashboard.html';
    return;
  }

  setupTabs();
  setupForms();
});

function setupTabs() {
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      forms.forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
      clearMessages();
    });
  });
}

function setupForms() {
  // LOGIN
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = e.target.querySelector('button[type="submit"]');

    setLoading(btn, true);
    clearMessages();

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      showMessage('loginMsg', '✅ Login realizado! Redirecionando...', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
    } catch (err) {
      showMessage('loginMsg', translateError(err.message), 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  // CADASTRO
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    const btn = e.target.querySelector('button[type="submit"]');

    clearMessages();

    if (!isValidEmail(email)) {
      showMessage('registerMsg', 'Digite um e-mail institucional válido.', 'error');
      return;
    }
    if (password.length < 6) {
      showMessage('registerMsg', 'A senha deve ter pelo menos 6 caracteres.', 'error');
      return;
    }
    if (password !== confirm) {
      showMessage('registerMsg', 'As senhas não coincidem.', 'error');
      return;
    }
    if (name.length < 3) {
      showMessage('registerMsg', 'Digite seu nome completo.', 'error');
      return;
    }

    setLoading(btn, true);

    try {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://jeanborech-senai.github.io/institucional/confirm.html',
          data: { full_name: name }
        }
      });
      if (error) throw error;

      // Cria perfil na tabela profiles
      if (data.user) {
        const { error: profileError } = await sb.from('profiles').insert({
          id: data.user.id,
          full_name: name,
          email: email,
          role: 'professor'
        });
        if (profileError && !profileError.message.includes('duplicate')) {
          console.warn('Aviso ao criar perfil:', profileError.message);
        }
      }

      showMessage('registerMsg', '✅ Cadastro realizado! Verifique seu e-mail para confirmar a conta.', 'success');
      document.getElementById('registerForm').reset();
    } catch (err) {
      showMessage('registerMsg', translateError(err.message), 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  // Validação visual do e-mail em tempo real
  document.getElementById('registerEmail').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val && !isValidEmail(val)) {
      e.target.style.borderColor = '#ef4444';
    } else {
      e.target.style.borderColor = '';
    }
  });

  // Força de senha visual
  document.getElementById('registerPassword').addEventListener('input', (e) => {
    updatePasswordStrength(e.target.value);
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function updatePasswordStrength(password) {
  const bar = document.getElementById('strengthBar');
  const label = document.getElementById('strengthLabel');
  if (!bar) return;

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: '', color: '#e2e8f0', width: '0%' },
    { label: 'Fraca', color: '#ef4444', width: '25%' },
    { label: 'Razoável', color: '#f59e0b', width: '50%' },
    { label: 'Boa', color: '#3b82f6', width: '75%' },
    { label: 'Forte', color: '#10b981', width: '100%' },
  ];
  const level = levels[Math.min(score, 4)];
  bar.style.width = level.width;
  bar.style.background = level.color;
  label.textContent = level.label;
  label.style.color = level.color;
}

function showMessage(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-message ${type}`;
  el.style.display = 'block';
}

function clearMessages() {
  document.querySelectorAll('.auth-message').forEach(el => {
    el.style.display = 'none';
    el.textContent = '';
  });
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Aguarde...' : btn.dataset.label || btn.textContent;
}

function translateError(msg) {
  const map = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'User already registered': 'Este e-mail já está cadastrado.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'Unable to validate email address: invalid format': 'Formato de e-mail inválido.',
  };
  return map[msg] || `Erro: ${msg}`;
}
