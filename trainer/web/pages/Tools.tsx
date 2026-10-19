// [X] 🧰 Công cụ: open the app on a phone over the local network (QR + access code) and export questions to Anki.
import { useRoute } from '../lib/router.ts';
import { LanCard } from '../components/tools/LanCard.tsx';
import { AnkiCard } from '../components/tools/AnkiCard.tsx';

export function Tools() {
  const route = useRoute();
  return (
    <div className="tools">
      <div className="page-head">
        <div>
          <h1>🧰 Công cụ</h1>
          <p>Học trên điện thoại trong cùng mạng Wi-Fi, và xuất câu hỏi sang Anki để ôn bằng flashcard.</p>
        </div>
      </div>
      <div className="stack tl-stack">
        <LanCard />
        <AnkiCard query={route.query} />
      </div>
    </div>
  );
}
