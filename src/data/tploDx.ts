// ① Diagnosis for suspected CrCL disease (C01, C02): radiographic assessment of the
// standard stifle series and the diagnosis / TPLO-indication confirmation. Every answer
// is read from this case's own clue text (basis); nothing is added from outside the case.
// Completion-checked only (not scored); first attempts are kept as feedback notes.

export interface DxItem {
  id: string;
  prompt: string;
  options: { id: string; text: string; correct: boolean }[];
  basis: string;
  why: string;
}

const item = (id: string, prompt: string, basis: string, why: string, correct: string, wrong: string[]): DxItem => ({
  id,
  prompt,
  basis,
  why,
  options: [
    { id: 'a', text: correct, correct: true },
    ...wrong.map((w, i) => ({ id: String.fromCharCode(98 + i), text: w, correct: false })),
  ],
});

export const TPLO_DX: Record<string, DxItem[]> = {
  C01: [
    item('effusion', '關節積液', 'C01-E2、C01-E3', '觸診與 X 光都記錄左膝積液。', '有（左膝積液）', ['無', '資料未提及']),
    item('oa', 'OA 變化', 'C01-E3', 'X 光判讀為輕度 OA。', '輕度 OA', ['無 OA', '重度 OA 伴關節變形']),
    item('tibia', '脛骨形態', 'C01-E3', 'X 光判讀 TPA 27°；未記錄其他脛骨變形，留待術前規劃測量確認。', 'TPA 27°，未記錄其他脛骨變形', ['脛骨近端骨折', '資料未提及 TPA']),
    item('comorbid', '其他共病／骨病變', 'C01-E3、全身狀態', 'X 光無骨折；全身狀態無急性異常。', '未見骨折或其他骨病變', ['髕骨脫位', '腫瘤性骨病變']),
    item('diagnosis', '綜合以上，診斷是否成立？', 'C01-E1–E3', '持續跛行、抽屜與脛骨推進陽性、積液與 OA，支持 CrCL disease／斷裂。', 'CrCL disease／斷裂診斷成立', ['資料不足，無法判斷', '診斷為髖關節疾病']),
    item('indication', 'TPLO 適應症', 'C01-E3、C01-E4', '診斷成立、骨骼成熟、高活動需求；TPA 需於術前規劃再量測。', '具 TPLO 適應症，進入處置選擇與術前規劃', ['不適合手術，僅止痛', '需先完成截骨才能確認']),
  ],
  C02: [
    item('effusion', '關節積液', 'C02-E3', 'X 光判讀記錄膝積液。', '有（膝積液）', ['無', '資料未提及']),
    item('oa', 'OA 變化', 'C02-E3', 'X 光判讀文字未提及 OA，不自行推論。', '判讀文字未提及', ['重度 OA', '確定無任何 OA']),
    item('tibia', '脛骨形態', 'C02-E3', 'TPA 32°，骨骼成熟；其他形態留待術前規劃確認。', 'TPA 32°，骨骼成熟', ['生長板未閉合', '資料未提及 TPA']),
    item('comorbid', '其他共病／骨病變', 'C02-E2', '觸診記錄髕骨無症狀性脫位，需在規劃與追蹤時一併記錄。', '髕骨無症狀性脫位（需記錄）', ['未見任何共病', '脛骨骨折']),
    item('diagnosis', '綜合以上，診斷是否成立？', 'C02-E1–E3', '間歇不負重、膝不穩定、積液，支持 CrCL disease。', 'CrCL disease 診斷成立', ['資料不足，無法判斷', '僅為髕骨脫位造成']),
    item('indication', 'TPLO 適應症', 'C02-E4', '小體型並非 TPLO 禁忌，需評估小型犬用植入物。', '具 TPLO 適應症（需小型植入物）', ['體重小於 10 kg 不可 TPLO', '需先完成截骨才能確認']),
  ],
};

export const dxItems = (caseId: string) => TPLO_DX[caseId] ?? [];
