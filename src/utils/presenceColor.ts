// Excalidraw 내부 커서/선택박스 색상 공식을 복제:
// Tn=(e,o)=>`hsl(${Math.abs(uI(o?.id||e))%37*10}, 100%, 83%)`
// uI: Java-style hash (hash<<5)-hash+charCode
// → 동일한 hue를 사용해 헤더 pill과 캔버스 커서/선택박스 색상을 일치
function excalidrawHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return hash;
}

export function getPresenceColor(userId: string): { background: string; stroke: string } {
  const hue = (Math.abs(excalidrawHash(userId)) % 37) * 10;
  // 헤더 pill: 같은 hue, 가독성을 위해 밝기 42% (Excalidraw 커서는 83%)
  const color = `hsl(${hue}, 75%, 42%)`;
  return { background: color, stroke: color };
}
