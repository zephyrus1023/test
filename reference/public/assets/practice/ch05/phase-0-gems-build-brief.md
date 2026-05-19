# Gems 시작 프롬프트

아래 지시를 Gems 또는 맞춤형 AI 비서에 넣고, 이번 실습에서 사용할 Build용 초안 프롬프트를 먼저 만든다.

```xml
<build_planning_request>
  <goal>
    임원용 경쟁사 리서치 대시보드를 React 앱으로 만들기 위한 초기 Build 프롬프트를 작성한다.
  </goal>
  <audience>
    CEO, 사업본부장, 전략기획 임원
  </audience>
  <app_type>
    경쟁사 뉴스와 기술 동향을 검색하고 요약하는 executive dashboard
  </app_type>
  <must_have_features>
    <feature>검색 입력창과 결과 카드</feature>
    <feature>핵심 시그널 요약 카드</feature>
    <feature>중요도 또는 urgency 표시</feature>
    <feature>임원 친화적인 상단 브리프 영역</feature>
  </must_have_features>
  <style_intent>
    LG 계열의 절제된 화이트 기반 UI를 기본으로 하되,
    필요하면 style prompt를 추가해 Pure Minimal Grid 또는 Scandinavian System 방향으로 바꿀 수 있게 한다.
  </style_intent>
  <constraints>
    <item>프레임워크는 React</item>
    <item>초안은 빠르게 동작하는 single-page app</item>
    <item>복잡한 인증이나 백엔드는 제외</item>
    <item>후속 refinement에 쓰기 쉽게 기능 블록을 분리</item>
  </constraints>
  <output_format>
    1. AI Studio Build에 바로 넣을 수 있는 자연어 프롬프트
    2. 같은 내용을 XML 구조 프롬프트로 다시 정리한 버전
    3. refinement 때 추가할 질문 5개
  </output_format>
</build_planning_request>
```

추가 요청 예시:

- `검색 결과 카드를 임원 브리핑용으로 더 절제되게 바꿔줘.`
- `이 초안을 XML 형식으로 다시 정리해줘.`
- `Pure Minimal Grid 스타일을 넣은 버전과 Scandinavian System 스타일을 넣은 버전을 둘 다 만들어줘.`
