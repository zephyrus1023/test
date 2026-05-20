const fs = require('fs');
const path = require('path');

// 1. 커맨드라인 인자 파싱 (--base-path 파싱)
let basePath = '';
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base-path' && i + 1 < args.length) {
    basePath = args[i + 1];
    break;
  } else if (args[i].startsWith('--base-path=')) {
    basePath = args[i].split('=')[1];
    break;
  }
}

// 끝 부분 슬래시 정리 (예: "/lets-ax/" -> "/lets-ax")
if (basePath.endsWith('/')) {
  basePath = basePath.slice(0, -1);
}

console.log(`[Build] 빌드 시작 (Base Path: "${basePath}")`);

const DIST_DIR = path.join(__dirname, 'dist-pages');

// 2. dist-pages 디렉토리 초기화
if (fs.existsSync(DIST_DIR)) {
  console.log(`[Build] 기존 dist-pages 디렉토리 삭제 중...`);
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR);

// 3. 폴더 및 파일 복사 헬퍼 함수 (Node 16 미만 하위 호환 대비 직접 재귀 구현 또는 fs.cpSync 사용)
function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

// 4. public 디렉토리 전체 복사
console.log(`[Build] public 디렉토리 리소스 복사 중...`);
copyFolderSync(path.join(__dirname, 'public'), DIST_DIR);

// 5. data 디렉토리 복사 (content_meta.json 파일이 위치)
console.log(`[Build] data 디렉토리 리소스 복사 중...`);
copyFolderSync(path.join(__dirname, 'data'), path.join(DIST_DIR, 'data'));

// 6. content 디렉토리 복사 (마크다운 교재 리소스가 위치)
console.log(`[Build] content 디렉토리 리소스 복사 중...`);
copyFolderSync(path.join(__dirname, 'content'), path.join(DIST_DIR, 'content'));

// 7. dist-pages/js/app.js 파일의 정적 데모 모드 상수 치환
const appJsPath = path.join(DIST_DIR, 'js', 'app.js');
if (fs.existsSync(appJsPath)) {
  console.log(`[Build] js/app.js 빌드 파라미터 주입 및 치환 중...`);
  let content = fs.readFileSync(appJsPath, 'utf8');
  
  // IS_STATIC_DEMO 및 STATIC_BASE_PATH 값을 덮어씁니다.
  content = content.replace('const IS_STATIC_DEMO = false;', 'const IS_STATIC_DEMO = true;');
  content = content.replace("const STATIC_BASE_PATH = '';", `const STATIC_BASE_PATH = '${basePath}';`);
  
  fs.writeFileSync(appJsPath, content, 'utf8');
  console.log(`[Build] js/app.js 치환 완료!`);
} else {
  console.error(`[Error] dist-pages/js/app.js 파일을 찾을 수 없습니다!`);
  process.exit(1);
}

// 8. Jekyll 빌드 비활성화를 위한 빈 .nojekyll 파일 생성
console.log(`[Build] Jekyll 무시용 .nojekyll 파일 생성 중...`);
fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '', 'utf8');

console.log(`[Build] GitHub Pages 용 정적 빌드가 완료되었습니다! -> ./dist-pages`);
