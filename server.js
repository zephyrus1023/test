const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 4071;
const SECRET_KEY = 'ax_lecture_vibrant_portal_key';

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 데이터 디렉토리 및 파일 초기화
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const META_FILE = path.join(DATA_DIR, 'content_meta.json');
const CONTENT_DIR = path.join(__dirname, 'content');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(CONTENT_DIR)) {
  fs.mkdirSync(CONTENT_DIR);
}

// 초기 관리자 생성 함수
function initAdminUser() {
  let users = [];
  if (fs.existsSync(USERS_FILE)) {
    try {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
      users = [];
    }
  }

  const adminExists = users.some(u => u.id === 'admin');
  if (!adminExists) {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('admin123', salt);
    users.push({
      id: 'admin',
      password: hashedPassword,
      name: '관리자',
      team: 'AX운영팀',
      role: 'admin'
    });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log('[Init] 기본 관리자 계정 생성 완료: id=admin / pw=admin123');
  }
}
initAdminUser();

// JWT 검증 미들웨어
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: '인증 토큰이 없습니다.' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
    req.user = user;
    next();
  });
}

// 관리자 권한 확인 미들웨어
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
}

// 헬퍼: 사용자 목록 가져오기
function getUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

// 헬퍼: 사용자 저장하기
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

// 헬퍼: 특정 클립의 파일 경로 조회
function getClipFilePath(clipId) {
  const chPart = clipId.split('-')[0].toUpperCase(); // 예: ch01 -> CH01
  const mdPath = path.join(CONTENT_DIR, chPart, `${clipId}.md`);
  const htmlPath = path.join(CONTENT_DIR, chPart, `${clipId}.html`);

  if (fs.existsSync(mdPath)) return { path: mdPath, type: 'md' };
  if (fs.existsSync(htmlPath)) return { path: htmlPath, type: 'html' };
  
  // 둘 다 없으면 기본적으로 md 파일 경로 반환 (생성용)
  const dirPath = path.join(CONTENT_DIR, chPart);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return { path: mdPath, type: 'md' };
}

// --- API 엔드포인트 ---

// 1. 회원가입 API
app.post('/api/signup', (req, res) => {
  const { id, password, name, team, courseCode } = req.body;

  if (!id || !password || !name || !team) {
    return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
  }

  // 간단한 코스 코드 인증 (기본: AXCAMP)
  if (courseCode && courseCode.trim().toUpperCase() !== 'AXCAMP') {
    return res.status(400).json({ error: '올바르지 않은 교육과정 코드입니다.' });
  }

  const users = getUsers();
  if (users.some(u => u.id === id)) {
    return res.status(400).json({ error: '이미 존재하는 계정아이디(Let\'s ID)입니다.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  // admin 아이디로 가입하면 admin 권한 부여
  const role = id.toLowerCase().includes('admin') ? 'admin' : 'student';

  const newUser = {
    id,
    password: hashedPassword,
    name,
    team,
    role
  };

  users.push(newUser);
  saveUsers(users);

  res.json({ message: '회원가입이 완료되었습니다.', role });
});

// 2. 로그인 API
app.post('/api/login', (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 모두 입력해주세요.' });
  }

  const users = getUsers();
  const user = users.find(u => u.id === id);

  if (!user) {
    return res.status(400).json({ error: '존재하지 않는 계정입니다.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ error: '비밀번호가 일치하지 않습니다.' });
  }

  // JWT 토큰 발급
  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role, team: user.team },
    SECRET_KEY,
    { expiresIn: '24h' }
  );

  res.json({
    message: '로그인에 성공했습니다.',
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      team: user.team
    }
  });
});

// 3. 목차 정보 가져오기 API
app.get('/api/chapters', (req, res) => {
  if (!fs.existsSync(META_FILE)) {
    return res.json([]);
  }
  try {
    const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
    res.json(meta);
  } catch (e) {
    res.status(500).json({ error: '목차 데이터를 불러오는데 실패했습니다.' });
  }
});

// 4. 특정 클립 본문 텍스트 조회 API
app.get('/api/content/:id', (req, res) => {
  const clipId = req.params.id;
  const { path: filePath, type } = getClipFilePath(clipId);

  if (!fs.existsSync(filePath)) {
    // 파일이 없으면 기본 마크다운 교재 양식을 생성하여 에러 방지
    const defaultTemplate = `# 새로운 강의 클립\n\n이 강의의 본문 내용을 입력해 주세요. 마크다운 문법을 완벽히 지원합니다.`;
    try {
      fs.writeFileSync(filePath, defaultTemplate, 'utf8');
    } catch (e) {
      return res.status(500).json({ error: '기본 교재 파일을 생성하는 중 오류가 발생했습니다.' });
    }
  }

  try {
    const bodyText = fs.readFileSync(filePath, 'utf8');
    res.json({ id: clipId, type, content: bodyText });
  } catch (e) {
    res.status(500).json({ error: '파일을 읽는 도중 오류가 발생했습니다.' });
  }
});

// 5. 강의 콘텐츠 저장 API (관리자 전용)
app.post('/api/content/:id/save', authenticateToken, requireAdmin, (req, res) => {
  const clipId = req.params.id;
  const { content } = req.body;

  if (content === undefined) {
    return res.status(400).json({ error: '저장할 내용이 없습니다.' });
  }

  const { path: filePath } = getClipFilePath(clipId);

  try {
    // 덮어쓰기 저장
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ message: '강의 콘텐츠가 성공적으로 저장되었습니다.' });
  } catch (e) {
    res.status(500).json({ error: '파일을 저장하는 도중 오류가 발생했습니다.' });
  }
});

// 6. 목차 메타데이터 전체 저장 API (관리자 전용)
app.post('/api/chapters/save', authenticateToken, requireAdmin, (req, res) => {
  const { chapters } = req.body;

  if (!chapters || !Array.isArray(chapters)) {
    return res.status(400).json({ error: '올바르지 않은 목차 데이터 형식입니다.' });
  }

  try {
    fs.writeFileSync(META_FILE, JSON.stringify(chapters, null, 2), 'utf8');
    res.json({ message: '사이드바 목차 데이터가 성공적으로 업데이트되었습니다.' });
  } catch (e) {
    res.status(500).json({ error: '목차 데이터를 저장하는 도중 오류가 발생했습니다.' });
  }
});

// SPA 프론트엔드 서빙 라우트 (API 제외한 모든 요청은 index.html로)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 기동
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`  AX CAMP FOR LEADERS - 활기찬 밝은 테마 포털 구동 중`);
  console.log(`  주소: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
