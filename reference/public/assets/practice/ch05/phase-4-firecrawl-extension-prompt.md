# Phase 4: Firecrawl Extension Prompt

추가 기능으로 Firecrawl API 연동을 넣어줘.

목표:
- 경쟁사 IR 페이지, 뉴스룸, 블로그를 직접 크롤링
- 크롤링 결과를 Markdown으로 변환
- 기존 대시보드 검색 결과와 함께 보여주기

요구사항:
- Firecrawl API Key 입력 필드
- 크롤링 대상 URL 입력 필드
- 결과를 요약 카드와 원문 링크로 정리
- 정기 크롤링 스케줄을 설정할 수 있는 UI 추가

주의:
- API key는 코드에 하드코딩하지 말고 환경 변수로 다룰 수 있게 구조를 나눠줘.
