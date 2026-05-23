// ==========================================================================
// 전역 애플리케이션 상태 관리 (State)
// ==========================================================================

const STATIC_CONFIG = window.__AX_STATIC_CONFIG__ || null;
const STATIC_MODE = Boolean(STATIC_CONFIG && STATIC_CONFIG.mode === 'static');

const state = {
  token: localStorage.getItem('ax_token') || null,
  user: JSON.parse(localStorage.getItem('ax_user')) || null,
  chapters: [],
  currentClipId: null,
  editMode: false,
  rawMarkdown: '',
  contextTargetChapterId: null,
  contextTargetClipId: null
};

// 빌드 스크립트(build.js)에서 정적 배포본 생성 시 치환 가능한 상수를 추가합니다.
const IS_STATIC_DEMO = false;
const STATIC_BASE_PATH = '';

const API_BASE = ''; // Same origin

// ==========================================================================
// 초기 구동 (App Initialization)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  checkAuthState();
  
  // 에디터 실시간 입력 시 프리뷰 연동
  const editorInput = document.getElementById('markdownEditorInput');
  if (editorInput) {
    editorInput.addEventListener('input', (e) => {
      state.rawMarkdown = e.target.value;
      renderLivePreview(state.rawMarkdown);
    });
  }

  // 우클릭 컨텍스트 메뉴 닫기 처리
  document.addEventListener('click', () => {
    hideSidebarContextMenu();
  });

  // 사이드바 우클릭 이벤트 리스너 설정
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.addEventListener('contextmenu', (e) => {
      // 교재 수정 모드이면서 관리자 계정일 때만 동작
      if (!state.editMode || !state.token || !state.user || state.user.role !== 'admin') return;
      
      e.preventDefault();
      
      const chapterTitleElement = e.target.closest('.chapter-title');
      const clipBtnElement = e.target.closest('.clip-btn');
      
      const menu = document.getElementById('sidebarContextMenu');
      const addChapterBtn = document.getElementById('ctxAddChapterBtn');
      const addClipBtn = document.getElementById('ctxAddClipBtn');
      const deleteChapterBtn = document.getElementById('ctxDeleteChapterBtn');
      const deleteClipBtn = document.getElementById('ctxDeleteClipBtn');
      
      if (!menu) return;

      // 메뉴 위치 조정
      menu.style.top = `${e.clientY}px`;
      menu.style.left = `${e.clientX}px`;
      menu.classList.remove('hidden');
      
      if (chapterTitleElement) {
        // 챕터 타이틀 위에서 우클릭 -> 강의 추가 및 챕터 삭제 활성화
        addChapterBtn.classList.add('hidden');
        addClipBtn.classList.remove('hidden');
        deleteChapterBtn.classList.remove('hidden');
        deleteClipBtn.classList.add('hidden');
        
        state.contextTargetChapterId = chapterTitleElement.dataset.chapterId;
        state.contextTargetClipId = null;
      } else if (clipBtnElement) {
        // 강의 클립 위에서 우클릭 -> 클립 삭제만 활성화
        addChapterBtn.classList.add('hidden');
        addClipBtn.classList.add('hidden');
        deleteChapterBtn.classList.add('hidden');
        deleteClipBtn.classList.remove('hidden');
        
        state.contextTargetClipId = clipBtnElement.dataset.clipId;
        state.contextTargetChapterId = clipBtnElement.dataset.chapterId;
      } else {
        // 사이드바 빈 영역 우클릭 -> 챕터 추가만 활성화
        addChapterBtn.classList.remove('hidden');
        addClipBtn.classList.add('hidden');
        deleteChapterBtn.classList.add('hidden');
        deleteClipBtn.classList.add('hidden');
        
        state.contextTargetChapterId = null;
        state.contextTargetClipId = null;
      }
    });
  }
});

// 로그인/회원가입 상태 확인
function checkAuthState() {
  const authView = document.getElementById('authView');
  const appView = document.getElementById('appView');
  
  if (STATIC_MODE) {
    // 정적 공개 모드일 때는 무조건 바로 입장
    authView.classList.add('hidden');
    appView.classList.remove('hidden');
    
    document.getElementById('userName').textContent = '수강생';
    document.getElementById('userTeam').textContent = '공개 과정';
    document.getElementById('welcomeName').textContent = '수강생';
    
    // 에디터는 비활성화
    const adminControls = document.getElementById('adminControls');
    const adminCard = document.getElementById('adminCard');
    if (adminControls) adminControls.classList.add('hidden');
    if (adminCard) adminCard.classList.add('hidden');
    
    loadChapters();
    goToHome();
    return;
  }
  
  if (state.token && state.user) {
    // 로그인 상태
    authView.classList.add('hidden');
    appView.classList.remove('hidden');
    
    // 유저 정보 바인딩
    document.getElementById('userName').textContent = state.user.name;
    document.getElementById('userTeam').textContent = state.user.team;
    document.getElementById('welcomeName').textContent = state.user.name;
    
    // 관리자 컨트롤 활성화 여부
    const adminControls = document.getElementById('adminControls');
    const adminCard = document.getElementById('adminCard');
    if (state.user.role === 'admin') {
      adminControls.classList.remove('hidden');
      adminCard.classList.remove('hidden');
    } else {
      adminControls.classList.add('hidden');
      adminCard.classList.add('hidden');
    }
    
    // 목차 로드 및 홈 대시보드 로드
    loadChapters();
    goToHome();
  } else {
    // 비로그인 상태
    authView.classList.remove('hidden');
    appView.classList.add('hidden');
  }
}

// ==========================================================================
// 1. 인증 기능 (Authentication)
// ==========================================================================

// 로그인/회원가입 탭 전환
function switchAuthTab(mode) {
  const tabLogin = document.getElementById('tabLoginBtn');
  const tabSignup = document.getElementById('tabSignupBtn');
  const formLogin = document.getElementById('loginForm');
  const formSignup = document.getElementById('signupForm');
  
  if (mode === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    formLogin.classList.add('active');
    formSignup.classList.remove('active');
  } else {
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
    formLogin.classList.remove('active');
    formSignup.classList.add('active');
  }
}

// 로그인 실행
async function handleLogin(e) {
  e.preventDefault();
  
  const idInput = document.getElementById('loginId').value.trim();
  const pwInput = document.getElementById('loginPassword').value;
  const errorMsg = document.getElementById('loginError');
  const submitBtn = document.getElementById('submitLoginBtn');
  
  errorMsg.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = '로그인 중...';
  
  try {
    if (IS_STATIC_DEMO) {
      // 데모 가상 로그인 처리 (admin 계정 및 일반 계정 시뮬레이션)
      if (idInput === 'admin' && pwInput === 'admin123') {
        const fakeData = {
          token: 'demo-fake-jwt-token-admin',
          user: {
            id: 'admin',
            name: '관리자(데모)',
            role: 'admin',
            team: 'AX운영팀'
          }
        };
        localStorage.setItem('ax_token', fakeData.token);
        localStorage.setItem('ax_user', JSON.stringify(fakeData.user));
        state.token = fakeData.token;
        state.user = fakeData.user;
        checkAuthState();
        return;
      } else if (idInput && pwInput) {
        const fakeData = {
          token: 'demo-fake-jwt-token-student',
          user: {
            id: idInput,
            name: `${idInput}님(데모)`,
            role: 'student',
            team: '데모참가팀'
          }
        };
        localStorage.setItem('ax_token', fakeData.token);
        localStorage.setItem('ax_user', JSON.stringify(fakeData.user));
        state.token = fakeData.token;
        state.user = fakeData.user;
        checkAuthState();
        return;
      } else {
        throw new Error('아이디와 비밀번호를 입력해주세요.');
      }
    }

    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idInput, password: pwInput })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || '로그인에 실패했습니다.');
    }
    
    // 로그인 성공 정보 세션 저장
    localStorage.setItem('ax_token', data.token);
    localStorage.setItem('ax_user', JSON.stringify(data.user));
    
    state.token = data.token;
    state.user = data.user;
    
    // 인증 확인 및 화면전환
    checkAuthState();
    
  } catch (err) {
    errorMsg.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '로그인';
  }
}

// 회원가입 실행
async function handleSignup(e) {
  e.preventDefault();
  
  const idInput = document.getElementById('signupId').value.trim();
  const pwInput = document.getElementById('signupPassword').value;
  const nameInput = document.getElementById('signupName').value.trim();
  const teamInput = document.getElementById('signupTeam').value.trim();
  const courseCodeInput = document.getElementById('signupCourseCode').value.trim();
  const errorMsg = document.getElementById('signupError');
  const submitBtn = document.getElementById('submitSignupBtn');
  
  errorMsg.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = '가입 중...';
  
  try {
    if (IS_STATIC_DEMO) {
      if (courseCodeInput.toUpperCase() !== 'AXCAMP') {
        throw new Error('올바르지 않은 교육과정 코드입니다.');
      }
      alert('회원가입에 성공했습니다! (데모 가상 계정)\n가입하신 아이디로 로그인해주세요.');
      switchAuthTab('login');
      document.getElementById('loginId').value = idInput;
      document.getElementById('loginPassword').value = '';
      return;
    }

    const res = await fetch(`${API_BASE}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: idInput,
        password: pwInput,
        name: nameInput,
        team: teamInput,
        courseCode: courseCodeInput
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || '회원가입에 실패했습니다.');
    }
    
    alert('회원가입에 성공했습니다! 가입한 아이디로 로그인해주세요.');
    
    // 로그인 폼으로 전환 및 값 채워넣기
    switchAuthTab('login');
    document.getElementById('loginId').value = idInput;
    document.getElementById('loginPassword').value = '';
    
  } catch (err) {
    errorMsg.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '회원가입 완료';
  }
}

// 로그아웃 실행
function handleLogout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.removeItem('ax_token');
    localStorage.removeItem('ax_user');
    
    state.token = null;
    state.user = null;
    state.currentClipId = null;
    state.editMode = false;
    
    checkAuthState();
  }
}

// ==========================================================================
// 2. 강의 및 목차 기능 (Viewer & Navigation)
// ==========================================================================

// 홈 대시보드로 이동
function goToHome() {
  state.currentClipId = null;
  state.editMode = false;
  
  // 뷰어 및 에디터 끄기, 대시보드 켜기
  document.getElementById('homeDashboard').classList.remove('hidden');
  document.getElementById('viewerContainer').classList.add('hidden');
  document.getElementById('editorContainer').classList.add('hidden');
  
  // 사이드바 활성화 클래스들 제거
  document.querySelectorAll('.clip-btn').forEach(btn => btn.classList.remove('active'));
}

// 목차 불러오기
async function loadChapters() {
  const chapterList = document.getElementById('chapterList');
  
  try {
    let data;
    if (STATIC_MODE) {
      const basePath = STATIC_CONFIG.basePath || '';
      const res = await fetch(`${basePath}/data/chapters.json`);
      if (!res.ok) throw new Error('정적 목차 데이터를 가져올 수 없습니다.');
      data = await res.json();
    } else {
      const res = await fetch(`${API_BASE}/api/chapters`);
      if (!res.ok) throw new Error('목차 데이터를 가져올 수 없습니다.');
      data = await res.json();
    }
    
    state.chapters = data;
    
    // 사이드바 목차 HTML 렌더링
    chapterList.innerHTML = '';
    
    if (state.chapters.length === 0) {
      chapterList.innerHTML = '<p class="muted">등록된 강의가 없습니다.</p>';
      return;
    }
    
    state.chapters.forEach(ch => {
      const group = document.createElement('div');
      group.className = 'chapter-group';
      
      const title = document.createElement('div');
      title.className = 'chapter-title';
      title.dataset.chapterId = ch.id; // 우클릭 챕터 식별용
      title.innerHTML = `<i class="fa-regular fa-folder-open"></i> ${ch.title}`;
      group.appendChild(title);
      
      const list = document.createElement('ul');
      list.className = 'clip-list';
      
      ch.clips.forEach(clip => {
        const item = document.createElement('li');
        item.className = 'clip-item';
        
        const pillClass = clip.type === '실습' ? 'clip-pill-practice' : 'clip-pill-concept';
        
        item.innerHTML = `
          <button class="clip-btn" id="btn-${clip.id}" data-clip-id="${clip.id}" data-chapter-id="${ch.id}" onclick="selectClip('${clip.id}')">
            <span>${clip.title}</span>
            <span class="clip-pill ${pillClass}">${clip.type}</span>
          </button>
        `;
        list.appendChild(item);
      });
      
      group.appendChild(list);
      chapterList.appendChild(group);
    });
    
  } catch (err) {
    chapterList.innerHTML = `<p class="auth-error-message">${err.message}</p>`;
  }
}

// 특정 클립 선택 시
async function selectClip(clipId) {
  state.currentClipId = clipId;
  state.editMode = false;
  
  // UI 뷰 전환
  document.getElementById('homeDashboard').classList.add('hidden');
  document.getElementById('viewerContainer').classList.remove('hidden');
  document.getElementById('editorContainer').classList.add('hidden');
  
  // 사이드바 액티브 효과 적용
  document.querySelectorAll('.clip-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-${clipId}`);
  if (activeBtn) activeBtn.classList.add('active');
  
  const viewer = document.getElementById('clipViewer');
  viewer.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line"></div>';
  
  try {
    let data;
    if (STATIC_MODE) {
      const basePath = STATIC_CONFIG.basePath || '';
      const res = await fetch(`${basePath}/data/clips/${clipId}.json`);
      if (!res.ok) throw new Error('정적 교재 본문을 불러오는 데 실패했습니다.');
      data = await res.json();
    } else {
      const res = await fetch(`${API_BASE}/api/content/${clipId}`);
      if (!res.ok) throw new Error('교재 본문을 불러오는 데 실패했습니다.');
      data = await res.json();
    }
    state.rawMarkdown = data.content;
    
    // 마크다운 파싱 및 표시
    viewer.innerHTML = parseMarkdown(state.rawMarkdown);
    
  } catch (err) {
    viewer.innerHTML = `<div class="auth-error-message"><h3>오류</h3><p>${err.message}</p></div>`;
  }
}

// 마크다운 커스텀 파싱 전처리 (알림 블록 처리 등)
function parseMarkdown(md) {
  if (!marked) return md;
  
  // GitHub Style Alert blockquotes [!TIP] / [!NOTE] 등 처리
  let parsed = md
    .replace(/>\s*\[!NOTE\]\s*\n/gi, '> **[알림 (Note)]** ')
    .replace(/>\s*\[!TIP\]\s*\n/gi, '> **[꿀팁 (Tip)]** ')
    .replace(/>\s*\[!IMPORTANT\]\s*\n/gi, '> **[중요 (Important)]** ')
    .replace(/>\s*\[!WARNING\]\s*\n/gi, '> **[경고 (Warning)]** ');
    
  return marked.parse(parsed);
}

// 사이드바 토글 동작
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
}

// ==========================================================================
// 3. 교재 실시간 편집 및 저장 (Editor - Admin Only)
// ==========================================================================

// 교재 수정 모드 토글
async function toggleEditMode() {
  if (state.user.role !== 'admin') {
    alert('관리자 권한이 없습니다.');
    return;
  }
  
  if (!state.currentClipId) {
    // 등록된 첫 번째 챕터의 첫 번째 강의 클립을 찾아 자동 선택
    const firstChapter = state.chapters.find(ch => ch.clips && ch.clips.length > 0);
    if (firstChapter && firstChapter.clips.length > 0) {
      const firstClipId = firstChapter.clips[0].id;
      await selectClip(firstClipId);
    } else {
      alert('수정할 강의 클립이 존재하지 않습니다. 목차에서 마우스 우클릭을 통해 먼저 챕터와 강의를 생성해주세요.');
      return;
    }
  }
  
  state.editMode = !state.editMode;
  
  const viewerContainer = document.getElementById('viewerContainer');
  const editorContainer = document.getElementById('editorContainer');
  const editBtn = document.getElementById('editModeToggleBtn');
  
  if (state.editMode) {
    // 에디터 켜기
    viewerContainer.classList.add('hidden');
    editorContainer.classList.remove('hidden');
    editBtn.innerHTML = '<i class="fa-solid fa-eye"></i> 일반 뷰어 모드';
    editBtn.classList.add('btn-primary');
    
    // 에디터 입력란에 원본 마크다운 바인딩
    document.getElementById('editingClipPath').querySelector('code').textContent = `content/${state.currentClipId.split('-')[0].toUpperCase()}/${state.currentClipId}.md`;
    document.getElementById('markdownEditorInput').value = state.rawMarkdown;
    
    // 실시간 프리뷰 초기 렌더링
    renderLivePreview(state.rawMarkdown);
  } else {
    // 에디터 끄기
    viewerContainer.classList.remove('hidden');
    editorContainer.classList.add('hidden');
    editBtn.innerHTML = '<i class="fa-regular fa-pen-to-square"></i> 교재 수정 모드';
    editBtn.classList.remove('btn-primary');
    
    // 최신 캐싱 마크다운 적용하여 뷰어 재렌더링
    document.getElementById('clipViewer').innerHTML = parseMarkdown(state.rawMarkdown);
  }
}

// 실시간 마크다운 프리뷰 렌더러
function renderLivePreview(md) {
  const preview = document.getElementById('markdownPreview');
  preview.innerHTML = parseMarkdown(md);
}

// 에디터 수정본 서버 저장 API 요청
async function saveContent() {
  if (STATIC_MODE) {
    alert('이 기능은 GitHub Pages 공개판에서 비활성화됩니다.');
    return;
  }
  
  if (!confirm('현재 편집 중인 강의 교재 내용을 저장하고 모든 사용자에게 실시간 반영하시겠습니까?')) {
    return;
  }
  
  const saveBtn = document.querySelector('.editor-actions .btn-primary');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...';
  
  try {
    const res = await fetch(`${API_BASE}/api/content/${state.currentClipId}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ content: state.rawMarkdown })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || '콘텐츠 저장 도중 오류가 발생했습니다.');
    }
    
    alert('교재 내용이 서버에 안전하게 저장되었습니다!');
    
    // 에디터 끄고 뷰어 모드로 자동 전환
    toggleEditMode();
    
  } catch (err) {
    alert(err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 저장 및 동기화';
  }
}

// ==========================================================================
// 4. 사이드바 실시간 챕터/강의 추가 (Context Menu Actions)
// ==========================================================================

// 컨텍스트 메뉴 감추기
function hideSidebarContextMenu() {
  const menu = document.getElementById('sidebarContextMenu');
  if (menu) menu.classList.add('hidden');
}

// 새 챕터 추가 처리
async function triggerAddChapter() {
  hideSidebarContextMenu();
  
  const titleInput = prompt("추가할 새 챕터의 제목을 입력해 주세요:\n(예: CH03. 새로운 챕터)");
  if (!titleInput || !titleInput.trim()) return;
  
  // 자동 CH번호 연산 (CH01, CH02 다음은 CH03)
  const nextNum = state.chapters.length + 1;
  const newChId = `CH${String(nextNum).padStart(2, '0')}`;
  
  const newChapter = {
    id: newChId,
    title: titleInput.trim(),
    clips: []
  };
  
  const updatedChapters = [...state.chapters, newChapter];
  await saveChaptersMeta(updatedChapters);
}

// 새 강의 클립 추가 처리
async function triggerAddClip() {
  hideSidebarContextMenu();
  
  if (!state.contextTargetChapterId) return;
  
  const chId = state.contextTargetChapterId;
  const targetChapter = state.chapters.find(ch => ch.id === chId);
  if (!targetChapter) return;
  
  const titleInput = prompt("이 챕터에 추가할 강의 클립 제목을 입력해 주세요:\n(예: 03. 프롬프트 작성 실습)");
  if (!titleInput || !titleInput.trim()) return;
  
  const typeInput = confirm("이 강의 클립 유형이 '실습' 입니까?\n[확인]을 누르면 '실습', [취소]를 누르면 '개념'으로 설정됩니다.");
  const clipType = typeInput ? '실습' : '개념';
  
  // ch01-clip03 형태의 ID 생성
  const chLower = chId.toLowerCase();
  const nextClipNum = targetChapter.clips.length + 1;
  const newClipId = `${chLower}-clip${String(nextClipNum).padStart(2, '0')}`;
  
  const newClip = {
    id: newClipId,
    title: titleInput.trim(),
    type: clipType
  };
  
  targetChapter.clips.push(newClip);
  await saveChaptersMeta(state.chapters);
  
  // 생성 즉시 해당 신규 클립으로 자동 선택/조회
  selectClip(newClipId);
}

// 목차 메타데이터 전체 저장 API 호출
async function saveChaptersMeta(updatedChapters) {
  try {
    if (IS_STATIC_DEMO) {
      alert('데모 환경(GitHub Pages)에서는 챕터/클립 구성이 디스크 파일에 영구적으로 저장되지 않습니다.\n대신 화면 상의 목차 구성에는 가상으로 즉시 반영됩니다.');
      state.chapters = updatedChapters;
      await loadChapters();
      return;
    }

    const res = await fetch(`${API_BASE}/api/chapters/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ chapters: updatedChapters })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || '목차 메타 데이터를 저장하는 데 실패했습니다.');
    }
    
    // 상태 동기화 및 렌더링 리로드
    state.chapters = updatedChapters;
    await loadChapters();
    
  } catch (err) {
    alert(err.message);
  }
}

// 챕터 삭제 처리
async function triggerDeleteChapter() {
  hideSidebarContextMenu();
  
  if (!state.contextTargetChapterId) return;
  
  const chId = state.contextTargetChapterId;
  const targetChapter = state.chapters.find(ch => ch.id === chId);
  if (!targetChapter) return;
  
  const confirmMsg = `정말로 챕터 '${targetChapter.title}'와 그 하위 강의 클립들을 전부 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`;
  if (!confirm(confirmMsg)) return;
  
  // 챕터 필터링하여 제외
  const updatedChapters = state.chapters.filter(ch => ch.id !== chId);
  
  // 만약 현재 열려있는 클립이 이 삭제된 챕터에 속해있었다면 홈 화면으로 보냄
  if (state.currentClipId && state.currentClipId.startsWith(chId.toLowerCase())) {
    goToHome();
  }
  
  await saveChaptersMeta(updatedChapters);
}

// 강의 클립 삭제 처리
async function triggerDeleteClip() {
  hideSidebarContextMenu();
  
  if (!state.contextTargetChapterId || !state.contextTargetClipId) return;
  
  const chId = state.contextTargetChapterId;
  const clipId = state.contextTargetClipId;
  
  const targetChapter = state.chapters.find(ch => ch.id === chId);
  if (!targetChapter) return;
  
  const targetClip = targetChapter.clips.find(clip => clip.id === clipId);
  if (!targetClip) return;
  
  const confirmMsg = `정말로 강의 클립 '${targetClip.title}'을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`;
  if (!confirm(confirmMsg)) return;
  
  // 해당 클립 제거
  targetChapter.clips = targetChapter.clips.filter(clip => clip.id !== clipId);
  
  // 만약 삭제하려는 강의가 현재 선택된 강의라면 홈 화면으로 복귀
  if (state.currentClipId === clipId) {
    goToHome();
  }
  
  await saveChaptersMeta(state.chapters);
}
