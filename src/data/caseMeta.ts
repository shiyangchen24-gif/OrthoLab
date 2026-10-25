// Game-side additions per case. These are teaching-game settings, not source
// data: patient names are fictional, and every reasoning question is answered
// only from clues / option conditions already in the workbook (see `basis`).

export type Limb = 'LF' | 'RF' | 'LH' | 'RH';

export const LIMB_LABEL: Record<Limb, string> = { LF: '左前肢', RF: '右前肢', LH: '左後肢', RH: '右後肢' };

export interface ReasoningOption {
  id: string;
  text: string;
  correct: boolean;
  why: string;
}

export interface ReasoningQuestion {
  id: 'location' | 'evidence' | 'missing';
  prompt: string;
  options: ReasoningOption[];
  basis: string[];
}

export interface CaseMeta {
  /** Fictional patient name (game setting). */
  name: string;
  /** Affected limb(s) derived from 病例庫「患側」. */
  limbs: Limb[];
  reasoning: ReasoningQuestion[];
}

const LOC = (correct: string[], why: string, basis: string[]): ReasoningQuestion => ({
  id: 'location',
  prompt: '病變主要位於哪個部位？',
  basis,
  options: [
    { id: 'stifle', text: '膝關節', correct: correct.includes('stifle'), why },
    { id: 'hip', text: '髖關節', correct: correct.includes('hip'), why },
    { id: 'radius', text: '前肢橈尺骨', correct: correct.includes('radius'), why },
    { id: 'femur', text: '股骨幹', correct: correct.includes('femur'), why },
    { id: 'spine', text: '脊椎／神經', correct: false, why: '病例資料沒有神經缺損或脊椎病變的證據。' },
  ],
});

const opt = (id: string, text: string, correct: boolean, why: string): ReasoningOption => ({ id, text, correct, why });

export const CASE_META: Record<string, CaseMeta> = {
  C01: {
    name: '阿福',
    limbs: ['LH'],
    reasoning: [
      LOC(['stifle'], '左膝積液、抽屜與脛骨推進陽性（C01-E2）。', ['C01-E2']),
      {
        id: 'evidence',
        prompt: '哪個檢查結果最支持目前判斷？',
        basis: ['C01-E2', 'C01-E3'],
        options: [
          opt('E2', '骨科觸診：左膝積液；抽屜與脛骨推進陽性', true, '膝不穩定的直接證據。'),
          opt('E3', 'X 光：TPA 27°、輕度 OA、無骨折', false, 'X 光排除骨折並提供規劃資料，但 TPA 本身不能證明不穩定。'),
          opt('E1', '步態／病史：持續左後肢跛行', false, '跛行只能指出患肢，不能定位病因。'),
        ],
      },
      {
        id: 'missing',
        prompt: '處置前，還有哪一項資料尚未確認？',
        basis: ['C01-E4', 'A01'],
        options: [
          opt('implant', '合適植入物的適配', true, 'C01-E4：「植入物適配需確認」；A01 必要條件也要求合適植入物。'),
          opt('tpa', 'TPA 數值', false, 'C01-E3 已提供 TPA 27°。'),
          opt('drawer', '抽屜試驗結果', false, 'C01-E2 已提供（陽性）。'),
          opt('weight', '依體重決定術式', false, '體重不能單獨決定術式（D01）。'),
        ],
      },
    ],
  },
  C02: {
    name: '布丁',
    limbs: ['LH'],
    reasoning: [
      LOC(['stifle'], '左膝不穩定（C02-E2）、膝積液（C02-E3）。', ['C02-E2', 'C02-E3']),
      {
        id: 'evidence',
        prompt: '哪個檢查結果最支持目前判斷？',
        basis: ['C02-E2'],
        options: [
          opt('E2', '骨科觸診：左膝不穩定，髕骨無症狀性脫位', true, '膝不穩定是處置決策的核心所見。'),
          opt('E3', 'X 光：膝積液，TPA 32°，無骨折', false, '支持膝病變並提供規劃資料，但不穩定需由觸診確認。'),
          opt('E1', '步態／病史：左後肢間歇不負重', false, '只能指出患肢。'),
        ],
      },
      {
        id: 'missing',
        prompt: '處置前，還有哪一項資料尚未確認？',
        basis: ['C02-E4', 'A05'],
        options: [
          opt('implant', '小型犬植入物的實際適配', true, 'C02-E4 只說「可評估」；A05 必要條件要求小型植入物適配。'),
          opt('tpa', 'TPA 數值', false, 'C02-E3 已提供 TPA 32°。'),
          opt('mature', '骨骼是否成熟', false, 'C02-E3 已說明骨骼成熟。'),
        ],
      },
    ],
  },
  C03: {
    name: '小約',
    limbs: ['RH'],
    reasoning: [
      LOC(['hip'], '右髖 ROM 疼痛、膝檢查無明顯異常（C03-E2）；右股骨頭變形塌陷（C03-E3）。', ['C03-E2', 'C03-E3']),
      {
        id: 'evidence',
        prompt: '哪個檢查結果最支持目前判斷？',
        basis: ['C03-E3'],
        options: [
          opt('E3', 'X 光：右股骨頭變形及塌陷，符合 LCPD', true, '影像直接顯示股骨頭病變。'),
          opt('E2', '骨科觸診：右髖 ROM 疼痛；膝檢查無明顯異常', false, '定位到髖，但需影像確認病因。'),
          opt('E1', '步態／病史：右後肢跛行及大腿萎縮', false, '只能指出患肢。'),
        ],
      },
      {
        id: 'missing',
        prompt: '若要評估 THR，還缺哪些資料？',
        basis: ['A10'],
        options: [
          opt('thr', '骨量、植入物、成熟度與專科評估', true, 'A10：這些條件本例尚未提供，因此 THR 為「條件不足」。'),
          opt('collapse', '股骨頭是否塌陷', false, 'C03-E3 已提供。'),
          opt('side', '患側', false, '已確認為右後肢。'),
        ],
      },
    ],
  },
  C04: {
    name: '毛球',
    limbs: ['RH'],
    reasoning: [
      LOC(['stifle'], '右 MPL grade II（C04-E2）、伸膝機制排列異常（C04-E3）。', ['C04-E2', 'C04-E3']),
      {
        id: 'evidence',
        prompt: '哪個檢查結果最支持目前判斷？',
        basis: ['C04-E2'],
        options: [
          opt('E2', '骨科觸診：右 MPL grade II 且重現症狀；CrCL 穩定', true, '確認髕骨脫位並與症狀相關。'),
          opt('E1', '步態／病史：右後肢頻繁跳步', false, '跳步提示問題，但需觸診確認。'),
          opt('E3', 'X 光：伸膝機制排列異常；無重大角度變形', false, '支持排列評估，但脫位與症狀的關聯來自觸診。'),
        ],
      },
      {
        id: 'missing',
        prompt: '以下哪一項在本模擬中仍是「假設」，實際需術中確認？',
        basis: ['C04-E4'],
        options: [
          opt('intraop', '滑車溝與粗隆的實際術中所見', true, 'C04-E4 寫明「本模擬另提供術中所見」。'),
          opt('ccl', '是否有 CrCL 不穩定', false, 'C04-E2 已提供：CrCL 穩定。'),
          opt('deform', '是否有重大角度變形', false, 'C04-E3 已提供：無重大角度變形。'),
        ],
      },
    ],
  },
  C05: {
    name: '豆豆',
    limbs: ['LH'],
    reasoning: [
      LOC(['stifle'], 'MPL grade I（C05-E2）。', ['C05-E2']),
      {
        id: 'evidence',
        prompt: '哪個檢查結果最支持目前判斷？',
        basis: ['C05-E2'],
        options: [
          opt('E2', '骨科觸診：MPL grade I；無痛，CrCL 穩定', true, '指出脫位程度且無疼痛。'),
          opt('E1', '步態／病史：步態正常，活動不受限', false, '說明沒有功能影響，但未定位髕骨問題。'),
          opt('E3', 'X 光：未見明顯 OA 或骨變形', false, '排除明顯骨性變化，不能確認髕骨脫位。'),
        ],
      },
      {
        id: 'missing',
        prompt: '目前還無法得知、需要追蹤才知道的是？',
        basis: ['P04', 'A19'],
        options: [
          opt('future', '日後是否出現跛行、疼痛或活動受限', true, '觀察計畫需追蹤症狀變化（P04、A19）。'),
          opt('pain', '目前是否疼痛', false, 'C05-E2 已提供：無痛。'),
          opt('oa', '是否有明顯 OA', false, 'C05-E3 已提供：未見明顯 OA。'),
        ],
      },
    ],
  },
  C06: {
    name: '灰灰',
    limbs: ['LH', 'RH'],
    reasoning: [
      LOC(['hip'], '雙髖活動不適（C06-E2）、雙髖退化影像（C06-E3）；病例患側為雙髖／多關節。', ['C06-E2', 'C06-E3']),
      {
        id: 'evidence',
        prompt: '哪個檢查結果最支持目前判斷？（影像須與症狀整合）',
        basis: ['C06-E2', 'C06-E3'],
        options: [
          opt('E2', '骨科觸診：雙髖活動不適；無急性神經缺損', true, '疼痛來源的臨床證據；影像需與此整合（C06-E3）。'),
          opt('E3', 'X 光：雙髖退化影像；須與症狀及功能整合', true, '影像支持判斷，但不能單獨決定；需與觸診及功能整合。'),
          opt('E4', '補充資訊：BCS 7/9', false, '體態影響管理計畫，但不是定位證據。'),
        ],
      },
      {
        id: 'missing',
        prompt: '開始止痛前，還需要確認什麼？',
        basis: ['C06 全身狀態', 'C06-E4', 'A21'],
        options: [
          opt('organ', '腎肝與全身評估、藥物適用性', true, 'C06 全身狀態：「用藥前仍需腎肝與全身評估」；C06-E4：藥物適用性待評估。'),
          opt('neuro', '是否有急性神經缺損', false, 'C06-E2 已提供：無。'),
          opt('bcs', '體態評分', false, '已提供 BCS 7/9。'),
        ],
      },
    ],
  },
  C07: {
    name: '雪球',
    limbs: ['LF'],
    reasoning: [
      LOC(['radius'], '左橈尺骨遠端 1/3 壓痛、骨摩擦音（C07-E2）；X 光橫斷骨折（C07-E3）。', ['C07-E2', 'C07-E3']),
      {
        id: 'evidence',
        prompt: '哪個檢查結果最支持目前判斷？',
        basis: ['C07-E3'],
        options: [
          opt('E3', 'X 光：左橈尺骨遠端橫斷性骨折，成角 18°，重疊短縮 3 mm', true, '影像確認骨折型態、位置與移位。'),
          opt('E2', '骨科觸診：遠端 1/3 壓痛、骨摩擦音與異常動度', false, '強烈提示骨折，但型態與移位需影像確認。'),
          opt('E1', '步態／病史：抬舉性跛行，腕上方輕微反折', false, '指出患肢與外觀，不能確認型態。'),
        ],
      },
      {
        id: 'missing',
        prompt: '進入手術前，還有哪一項尚未確認？',
        basis: ['A29', 'C07-E3', 'C07 全身狀態'],
        options: [
          opt('prep', '無菌手術評估與微型植入物準備', true, 'A29 必要條件；病例資料尚未提供。'),
          opt('physis', '生長板是否閉合', false, 'C07-E3 已提供：生長板閉合。'),
          opt('chest', '胸腔是否有氣胸或挫傷', false, '全身狀態已提供：胸腔 X 光無氣胸挫傷。'),
          opt('pattern', '骨折型態與成角', false, 'C07-E3 已提供。'),
        ],
      },
    ],
  },
  C08: {
    name: '橘子',
    limbs: ['RH'],
    reasoning: [
      LOC(['femur'], '右股骨幹中段劇痛、骨摩擦音（C08-E2）；短斜骨折（C08-E3）。', ['C08-E2', 'C08-E3']),
      {
        id: 'evidence',
        prompt: '哪個檢查結果最支持目前判斷？',
        basis: ['C08-E3'],
        options: [
          opt('E3', 'X 光：右股骨幹中段短斜骨折，重疊 12 mm，外側成角 15°', true, '影像確認骨折型態與移位。'),
          opt('E2', '骨科觸診：股骨幹中段劇痛、腫脹、骨摩擦音', false, '強烈提示骨折，但型態需影像確認。'),
          opt('E1', '步態／病史：右後肢完全不負重、蹲伏', false, '只能指出患肢。'),
        ],
      },
      {
        id: 'missing',
        prompt: '進入手術前，還有哪一項尚未確認？',
        basis: ['A33', 'C08 全身狀態', 'C08-E3'],
        options: [
          opt('kit', '骨科內固定器械是否齊備', true, 'A33 必要條件；病例資料尚未提供。'),
          opt('lung', '肺挫傷是否穩定', false, '全身狀態已提供：吸氧穩定 24 小時。'),
          opt('comminution', '是否有粉碎骨片', false, 'C08-E3 已提供：無粉碎骨片。'),
          opt('sciatic', '坐骨神經反射', false, 'C08-E2 已提供：正常。'),
        ],
      },
    ],
  },
};

export const metaFor = (caseId: string): CaseMeta | undefined => CASE_META[caseId];
