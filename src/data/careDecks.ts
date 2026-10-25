// Card decks for care stages and the T04 non-surgical module.
// Card text is taken from (or paraphrases) the source rows named in `basis`;
// distractors are built from limitations stated in the same rows. No drug
// doses, incidences or guaranteed timelines are introduced here.

export interface CareCard {
  id: string;
  text: string;
  correct: boolean;
  reason: string;
  basis: string;
  tag: '活動' | '傷口與疼痛' | '追蹤' | '警訊' | '目標' | '環境' | '體重' | '衛教';
}

export interface CareRound {
  id: string;
  title: string;
  prompt: string;
  cards: CareCard[];
  referenceIds: string[];
}

export interface CareDeck {
  id: string;
  carePlanId: string;
  title: string;
  rounds: CareRound[];
  simulatedFollowUp: string;
}

const TIMING_NOTE = '（時程為原始資料提案，待專科審閱，需依個體調整）';

export const CARE_DECKS: Record<string, CareDeck> = {
  'PROC-TPLO': {
    id: 'care-tplo',
    carePlanId: 'P01',
    title: 'TPLO 術後照護',
    simulatedFollowUp: '模擬情境：回診時傷口乾淨，患肢負重逐步增加；仍需依影像確認癒合後才調整活動。此為教學模擬，不代表實際病程。',
    rounds: [
      {
        id: 'r1',
        title: '術後照護計畫',
        prompt: '選出所有適合本病例的照護卡（可多選）。',
        referenceIds: ['R02', 'R10'],
        cards: [
          { id: 't1', tag: '活動', correct: true, text: '依醫囑限制跑跳；短牽繩、漸進治療運動', reason: '早期至骨癒合追蹤期的活動原則。', basis: 'P01' },
          { id: 't2', tag: '傷口與疼痛', correct: true, text: '傷口保護與疼痛評估；依處方用藥', reason: '疼痛與傷口需持續評估。', basis: 'P01' },
          { id: 't3', tag: '追蹤', correct: true, text: '傷口及步態回診；影像確認癒合後再調整活動', reason: '疼痛、負重與影像應分開記錄。', basis: 'P01' },
          { id: 't4', tag: '警訊', correct: true, text: '衛教警訊：突然不負重、腫痛、滲液或全身不適應聯絡獸醫', reason: '飼主需知道何時提前回診。', basis: 'P01' },
          { id: 't5', tag: '活動', correct: false, text: '手術完成即視為康復，可立即恢復自由奔跑', reason: '不是手術完成即完全恢復（T01-S4）。', basis: 'T01-S4' },
          { id: 't6', tag: '追蹤', correct: false, text: '只要疼痛分數改善，就不需要另外評估負重與影像', reason: '疼痛、負重與影像應分開記錄（P01 回饋重點）。', basis: 'P01' },
        ],
      },
    ],
  },
  'PROC-FHNE': {
    id: 'care-fhne',
    carePlanId: 'P02',
    title: 'FHNE 術後疼痛與功能復健',
    simulatedFollowUp: '模擬情境：疼痛控制後開始漸進使用患肢，持續追蹤 ROM 與肌肉量。功能結果因個體而異，不保證完全正常。',
    rounds: [
      {
        id: 'r1',
        title: '術後漸進恢復',
        prompt: '選出所有適合本病例的照護卡（可多選）。',
        referenceIds: ['R12', 'R10'],
        cards: [
          { id: 'f1', tag: '活動', correct: true, text: '止痛充分後依個體安排患肢使用及復健', reason: 'FHNE 術後依賴疼痛控制與功能復健。', basis: 'P02' },
          { id: 'f2', tag: '衛教', correct: true, text: '避免自行強拉患肢；復健動作先示範，再請飼主回教', reason: '確保居家復健安全。', basis: 'P02' },
          { id: 'f3', tag: '追蹤', correct: true, text: '追蹤 ROM、肌肉量及行走功能', reason: '以功能指標追蹤。', basis: 'P02' },
          { id: 'f4', tag: '警訊', correct: true, text: '衛教警訊：疼痛增加、持續拒用患肢或傷口異常', reason: '需提前回診的情況。', basis: 'P02' },
          { id: 'f5', tag: '衛教', correct: false, text: '向飼主保證術後關節會完全恢復正常', reason: '不保證完全正常；與 THR 結果不同（P02）。', basis: 'P02' },
          { id: 'f6', tag: '活動', correct: false, text: '術後長期避免使用患肢，直到完全不痛為止', reason: '止痛充分後應依個體安排患肢使用及復健（P02）。', basis: 'P02' },
        ],
      },
    ],
  },
  'PROC-MPL-COMBO': {
    id: 'care-mpl',
    carePlanId: 'P03',
    title: '髕骨脫位矯正術後照護',
    simulatedFollowUp: '模擬情境：回診時步態改善，髕骨軌跡維持；粗隆轉位處持續追蹤截骨癒合。此為教學模擬。',
    rounds: [
      {
        id: 'r1',
        title: '術後至截骨癒合',
        prompt: '選出所有適合本病例的照護卡（可多選）。',
        referenceIds: ['R03', 'R10'],
        cards: [
          { id: 'm1', tag: '活動', correct: true, text: '依實際矯正與固定方式安排活動', reason: '活動計畫取決於實際術式。', basis: 'P03' },
          { id: 'm2', tag: '傷口與疼痛', correct: true, text: '傷口保護與個別化止痛', reason: '依個體調整。', basis: 'P03' },
          { id: 'm3', tag: '追蹤', correct: true, text: '追蹤步態與髕骨軌跡；有截骨（粗隆轉位）者追蹤癒合', reason: '分別評估再脫位、疼痛與功能。', basis: 'P03' },
          { id: 'm4', tag: '警訊', correct: true, text: '衛教警訊：突然跳步加重、疼痛或傷口異常', reason: '需提前回診的情況。', basis: 'P03' },
          { id: 'm5', tag: '活動', correct: false, text: '直接套用 FHNE 術後活動方案', reason: '不能套用 FHNE 方案（P03）。', basis: 'P03' },
          { id: 'm6', tag: '追蹤', correct: false, text: '只要髕骨不再脫位，就不必評估疼痛與功能', reason: '再脫位、疼痛與功能應分別評估（P03）。', basis: 'P03' },
        ],
      },
    ],
  },
  'PROC-ORIF-PLATE': {
    id: 'care-orif',
    carePlanId: 'P06',
    title: '骨折內固定術後照護',
    simulatedFollowUp: '模擬情境：回診影像顯示骨折處持續癒合中，活動依癒合進度逐步放寬。此為教學模擬，不承諾固定時間完全康復。',
    rounds: [
      {
        id: 'r1',
        title: '術後早期至骨癒合期',
        prompt: '選出所有適合本病例的照護卡（可多選）。',
        referenceIds: ['R13', 'R14'],
        cards: [
          { id: 'o1', tag: '活動', correct: true, text: `嚴格牽繩散步／籠休，禁止奔跑與上下家具${TIMING_NOTE}`, reason: '早期過度負載可能使植入物承受過大應力。', basis: 'P06' },
          { id: 'o2', tag: '傷口與疼痛', correct: true, text: '術後冰敷、每日檢查敷料、配戴伊莉莎白圈防舔', reason: '傷口保護。', basis: 'P06' },
          { id: 'o3', tag: '追蹤', correct: true, text: `回診 X 光評估骨癒合進度，再逐步放寬活動${TIMING_NOTE}`, reason: '依影像癒合進度調整，而非依外觀。', basis: 'P06' },
          { id: 'o4', tag: '警訊', correct: true, text: '衛教警訊：再次完全不負重、手術部位異常發熱腫脹、植入物皮下突起', reason: '需提前回診的情況。', basis: 'P06' },
          { id: 'o5', tag: '活動', correct: false, text: '皮膚拆線後即可恢復正常跑跳', reason: '骨癒合不等於皮膚拆線即好（P06 回饋重點）。', basis: 'P06' },
          { id: 'o6', tag: '追蹤', correct: false, text: '外觀正常就不需要影像追蹤', reason: '需以回診影像評估骨癒合（P06）。', basis: 'P06' },
        ],
      },
    ],
  },
};

/** T04 non-surgical decks: C05 (observation) and C06 (chronic OA) are deliberately different. */
export const NONSURGICAL_DECKS: Record<string, CareDeck> = {
  C05: {
    id: 'ns-c05',
    carePlanId: 'P04',
    title: '無症狀輕度 MPL：觀察追蹤計畫',
    simulatedFollowUp: '模擬情境：追蹤期間步態維持正常，飼主依計畫記錄活動變化。若出現新症狀會提前回診重新評估。',
    rounds: [
      {
        id: 's1',
        title: 'S1 選擇管理目標',
        prompt: '本病例的管理目標是什麼？（可多選）',
        referenceIds: ['R03'],
        cards: [
          { id: 'g1', tag: '目標', correct: true, text: '維持正常活動與功能，監測是否出現症狀', reason: '無痛、無跛行、grade I：依症狀追蹤（A17）。', basis: 'A17' },
          { id: 'g2', tag: '衛教', correct: true, text: '讓飼主了解 MPL grade I 的意義與觀察重點', reason: '飼主可監測症狀並配合追蹤（C05-E4）。', basis: 'C05-E4' },
          { id: 'g3', tag: '目標', correct: false, text: '立即消除髕骨脫位', reason: '不能僅因有脫位就一律手術（A18）。', basis: 'A18' },
          { id: 'g4', tag: '傷口與疼痛', correct: false, text: '開始例行止痛以預防疼痛', reason: '無症狀時不自動給止痛藥；觀察病例不需例行用藥（P04、T04-S1）。', basis: 'P04' },
        ],
      },
      {
        id: 's2',
        title: 'S2 制定個別化計畫',
        prompt: '選出適合本病例的日常照護（可多選）。',
        referenceIds: ['R03'],
        cards: [
          { id: 'p1', tag: '活動', correct: true, text: '維持日常適量活動', reason: 'P04 非手術追蹤。', basis: 'P04' },
          { id: 'p2', tag: '衛教', correct: true, text: '教飼主觀察跳步與活動變化', reason: 'P04 非手術追蹤。', basis: 'P04' },
          { id: 'p3', tag: '活動', correct: false, text: '長期嚴格籠休', reason: '所有病例不共用籠休方案（T04-S2）；本例無功能限制。', basis: 'T04-S2' },
          { id: 'p4', tag: '傷口與疼痛', correct: false, text: '例行使用止痛藥並加上雷射', reason: '不是所有病例都籠休、用藥加雷射（T04）。', basis: 'T04' },
        ],
      },
      {
        id: 's3',
        title: 'S3 追蹤與警訊',
        prompt: '選出回診條件與追蹤方式（可多選）。',
        referenceIds: ['R03'],
        cards: [
          { id: 'f1', tag: '追蹤', correct: true, text: '依獸醫計畫定期追蹤', reason: 'P04。', basis: 'P04' },
          { id: 'f2', tag: '警訊', correct: true, text: '出現新發跛行、疼痛或活動受限時提前回診', reason: 'A19、P04。', basis: 'P04' },
          { id: 'f3', tag: '衛教', correct: true, text: '說明「觀察」不等於永不治療', reason: 'P04 回饋重點。', basis: 'P04' },
          { id: 'f4', tag: '追蹤', correct: false, text: '無症狀就不需要任何追蹤', reason: '應提供活動功能監測與回診條件（A20）。', basis: 'A20' },
          { id: 'f5', tag: '衛教', correct: false, text: '保證永遠不會惡化', reason: '不得承諾固定結果（T04-S3）。', basis: 'T04-S3' },
        ],
      },
    ],
  },
  C06: {
    id: 'ns-c06',
    carePlanId: 'P05',
    title: '貓慢性 OA：個別化疼痛與功能管理',
    simulatedFollowUp: '模擬情境：調整環境與體重管理後，飼主回報跳躍意願改善；計畫依治療反應持續調整，沒有固定的完全康復日期。',
    rounds: [
      {
        id: 's1',
        title: 'S1 選擇管理目標',
        prompt: '本病例的管理目標是什麼？（可多選）',
        referenceIds: ['R10'],
        cards: [
          { id: 'g1', tag: '目標', correct: true, text: '改善舒適度與跳躍、活動功能', reason: '以功能與舒適度追蹤（A21）。', basis: 'A21' },
          { id: 'g2', tag: '目標', correct: true, text: '用藥前先評估腎肝功能與共病', reason: '用藥前仍需腎肝與全身評估（C06 全身狀態）。', basis: 'C06' },
          { id: 'g3', tag: '目標', correct: false, text: '以影像上骨刺消失為目標', reason: '依疼痛功能及全身狀況，不能只看骨刺（D08）。', basis: 'D08' },
          { id: 'g4', tag: '目標', correct: false, text: '盡快安排全髖關節置換', reason: '目前資料不足直接進入置換手術（A22）。', basis: 'A22' },
        ],
      },
      {
        id: 's2',
        title: 'S2 制定個別化計畫',
        prompt: '選出適合本病例的管理內容（可多選）。',
        referenceIds: ['R10'],
        cards: [
          { id: 'p1', tag: '傷口與疼痛', correct: true, text: '評估共病後個別化止痛（藥物與劑量由獸醫依個體決定）', reason: 'P05；本遊戲不提供劑量。', basis: 'P05' },
          { id: 'p2', tag: '體重', correct: true, text: '體重管理（目前 BCS 7/9）', reason: 'P05、C06-E4。', basis: 'P05' },
          { id: 'p3', tag: '環境', correct: true, text: '環境調整：止滑地面、低階平台、易進出砂盆', reason: 'P05。', basis: 'P05' },
          { id: 'p4', tag: '活動', correct: true, text: '維持適量活動', reason: 'P05。', basis: 'P05' },
          { id: 'p5', tag: '活動', correct: false, text: '長期嚴格籠休', reason: '無急性需固定損傷，應個別化活動與環境（A24）。', basis: 'A24' },
          { id: 'p6', tag: '傷口與疼痛', correct: false, text: '只做雷射治療', reason: '輔助療法不能代表完整照護計畫（A23）。', basis: 'A23' },
          { id: 'p7', tag: '傷口與疼痛', correct: false, text: '直接沿用犬的止痛藥方案', reason: '犬貓管理細節與用藥不可直接互換（D08）。', basis: 'D08' },
        ],
      },
      {
        id: 's3',
        title: 'S3 追蹤與警訊',
        prompt: '選出追蹤方式與警訊（可多選）。',
        referenceIds: ['R10'],
        cards: [
          { id: 'f1', tag: '追蹤', correct: true, text: '追蹤跳躍、活動、疼痛及治療反應', reason: 'P05。', basis: 'P05' },
          { id: 'f2', tag: '警訊', correct: true, text: '衛教警訊：食慾或精神下降、嘔吐等用藥疑慮應聯絡獸醫', reason: 'P05。', basis: 'P05' },
          { id: 'f3', tag: '衛教', correct: true, text: '慢性疼痛需持續調整，沒有固定的完全康復日期', reason: 'P05 回饋重點。', basis: 'P05' },
          { id: 'f4', tag: '衛教', correct: false, text: '承諾一個月內完全康復', reason: '不得承諾固定時間完全康復（T04-S3）。', basis: 'T04-S3' },
          { id: 'f5', tag: '追蹤', correct: false, text: '症狀穩定後可自行停止所有追蹤', reason: '慢性疼痛需反覆評估（A21）。', basis: 'A21' },
        ],
      },
    ],
  },
};

export interface RoundResult {
  roundId: string;
  firstScore: number;
  passed: boolean;
}

/** Score a submission: (correct picked − wrong picked) / total correct, floored at 0. */
export function scoreRound(round: CareRound, picked: string[]): { score: number; passed: boolean; missed: CareCard[]; wrong: CareCard[] } {
  const correct = round.cards.filter((c) => c.correct);
  const hit = correct.filter((c) => picked.includes(c.id));
  const wrong = round.cards.filter((c) => !c.correct && picked.includes(c.id));
  const missed = correct.filter((c) => !picked.includes(c.id));
  const score = Math.max(0, Math.round(((hit.length - wrong.length) / correct.length) * 100));
  return { score, passed: missed.length === 0 && wrong.length === 0, missed, wrong };
}
