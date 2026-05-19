## Browser Automation Rules

- `AX_CAMP`의 `4071` 포트는 사용자가 유지하는 보호 포트로 취급한다.
- Codex는 `4071` 서버를 죽이거나 교체하지 않는다.
- localhost UI 검증은 사용자가 `npm start`로 서버를 띄우고, Codex가 Playwright로 붙는 방식을 기본값으로 사용한다.
- `NotebookLM`은 UI 중심 작업에서 Playwright 우선이다.
- NotebookLM 로그인 화면이 뜨면, 사용자가 **같은 Playwright 탭**에서 로그인한 뒤 Codex가 계속 이어서 제어한다.
- `Gmail`은 작업 유형에 따라 다르게 쓴다.
	- 단순 발송, 검색, 초안, 라벨 작업은 Gmail 도구 우선
	- 첨부파일 포함 발송, compose UI 검토, 브라우저 상 최종 확인이 필요하면 Playwright Gmail 웹 경로 사용 가능
- Gmail 웹 발송은 **이미 로그인된 같은 Playwright 탭**이 있을 때만 표준으로 사용한다.
- Gmail 웹 첨부 발송의 현재 검증 범위:
	- inbox 진입
	- 편지쓰기
	- 수신자/제목/본문 입력
	- 로컬 파일 첨부
	- 실제 발송
- `Genspark`는 브라우저 우선 검토 대상으로 유지하되, 로그인/업로드/생성/다운로드 전부 실제 검증되기 전까지는 후보 상태로 둔다.
- 일반 Chrome과 Playwright가 같은 프로필을 동시에 공유하는 운영은 기본값으로 쓰지 않는다.
- 문서화는 실제로 성공한 경로만 표준으로 승격하고, 미검증 흐름은 후보로 남긴다.

## References

- 상세 운영 메모: [docs/BROWSER_AUTOMATION_RUNBOOK.md](C:/Users/angpa/myProjects/Daily_Work/AX_CAMP/docs/BROWSER_AUTOMATION_RUNBOOK.md)
- 전역 반영용 스니펫: [docs/GLOBAL_AGENTS_BROWSER_SNIPPET.md](C:/Users/angpa/myProjects/Daily_Work/AX_CAMP/docs/GLOBAL_AGENTS_BROWSER_SNIPPET.md)
