// Schematic lateral (ML) stifle/tibia radiograph for TPLO planning and surgery.
// Teaching illustration drawn from the planning geometry (not a clinical image).
// Everything is in image px (the planning model's toImage transform), so overlays,
// landmarks and pointer input share one coordinate system.

import { useId, type ReactNode } from 'react';
import { IMAGE_SIZE, toImage, type TploGeometry } from '../../engine/tploPlan';
import type { Vec } from '../../engine/geometry';

export const pathOf = (pts: Vec[], close = true) => `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')}${close ? ' Z' : ''}`;

export function TploRadiograph({
  g,
  theme = 'xray',
  cut,
  rotation = 0,
  plate,
  children,
  label,
  svgRef,
  handlers,
  onImageClick,
  testId,
  focus = 'full',
}: {
  g: TploGeometry;
  /** 'proximal' zooms on the stifle for osteotomy / rotation / plate work */
  focus?: 'full' | 'proximal';
  theme?: 'xray' | 'op';
  /** osteotomy (local mm centre + radius): splits the bone into plateau and shaft segments */
  cut?: { O: Vec; R: number } | null;
  /** plateau segment rotation (deg, positive lowers the TPA) */
  rotation?: number;
  /** implant drawn on the rotated image (already in image px) */
  plate?: ReactNode;
  children?: ReactNode;
  label: string;
  svgRef?: React.Ref<SVGSVGElement>;
  handlers?: Record<string, unknown>;
  onImageClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  testId?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const xray = theme === 'xray';
  const img = (p: Vec) => toImage(g, p);
  const bonePath = pathOf(g.outline.map(img));
  const px = g.pxPerMm;
  const boneFill = xray ? `url(#${uid}-bone)` : `url(#${uid}-ivory)`;
  const boneStroke = xray ? '#E2E8F0' : '#B9A88E';
  const O = cut ? img(cut.O) : null;
  const Rpx = cut ? cut.R * px : 0;
  const bone = <path d={bonePath} fill={boneFill} stroke={boneStroke} strokeWidth={xray ? 1.6 : 1.2} strokeLinejoin="round" />;
  const canal = (
    <path
      d={pathOf([
        { x: -4, y: 40 },
        { x: -3.6, y: 150 },
        { x: 3.6, y: 150 },
        { x: 4, y: 40 },
      ].map((p) => img({ x: p.x * g.k, y: p.y * g.k })))}
      fill={xray ? '#64748B' : '#E9DCC6'}
      opacity={xray ? 0.35 : 0.6}
    />
  );
  const femur = g.femur;
  const W = IMAGE_SIZE.w;
  const H = IMAGE_SIZE.h;
  const Eimg = img(g.E);
  const vb = focus === 'proximal' ? { x: Eimg.x - 240, y: Eimg.y - 150, w: 480, h: 470 } : { x: 0, y: 0, w: W, h: H };
  // distal femur and shaft leaving the top of the film
  const femurShaft = pathOf(
    [
      { x: -15, y: -18 },
      { x: -24, y: -70 },
      { x: -22, y: -160 },
      { x: -2, y: -160 },
      { x: 2, y: -70 },
      { x: 17, y: -22 },
    ].map((p) => img({ x: p.x * g.k, y: p.y * g.k })),
  );
  return (
    <svg
      ref={svgRef}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className={`tplo-radiograph ${theme}`}
      role="img"
      aria-label={label}
      onClick={onImageClick}
      data-testid={testId}
      {...(handlers as object)}
    >
      <defs>
        <linearGradient id={`${uid}-bone`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#CBD5E1" />
          <stop offset=".5" stopColor="#F1F5F9" />
          <stop offset="1" stopColor="#CBD5E1" />
        </linearGradient>
        <linearGradient id={`${uid}-ivory`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E9DCC6" />
          <stop offset=".5" stopColor="#FBF5EA" />
          <stop offset="1" stopColor="#DCCBAE" />
        </linearGradient>
        <radialGradient id={`${uid}-soft`} cx=".5" cy=".4" r=".6">
          <stop offset="0" stopColor={xray ? '#475569' : '#2F7F86'} stopOpacity={xray ? 0.55 : 0.25} />
          <stop offset="1" stopColor={xray ? '#0B0F14' : '#1F5F66'} stopOpacity="0" />
        </radialGradient>
        {cut && O && (
          <>
            <clipPath id={`${uid}-prox`}>
              <circle cx={O.x} cy={O.y} r={Rpx} />
            </clipPath>
            <clipPath id={`${uid}-dist`}>
              <path d={`M0 0 H${W} V${H} H0 Z M${O.x + Rpx} ${O.y} A${Rpx} ${Rpx} 0 1 0 ${O.x - Rpx} ${O.y} A${Rpx} ${Rpx} 0 1 0 ${O.x + Rpx} ${O.y} Z`} clipRule="evenodd" />
            </clipPath>
          </>
        )}
      </defs>
      <rect x={-W} y={-H} width={W * 3} height={H * 3} fill={xray ? '#05080B' : '#2C6E74'} />
      <ellipse cx={W * 0.55} cy={H * 0.42} rx={W * 0.42} ry={H * 0.5} fill={`url(#${uid}-soft)`} />
      {/* femoral condyles and patella (static) */}
      <g opacity={xray ? 0.75 : 0.9}>
        <path d={femurShaft} fill={boneFill} stroke={boneStroke} strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx={img(femur.c).x} cy={img(femur.c).y} r={femur.r * px} fill={boneFill} stroke={boneStroke} strokeWidth="1.2" />
      </g>
      <ellipse cx={img(g.patella.c).x} cy={img(g.patella.c).y} rx={g.patella.r * px * 0.75} ry={g.patella.r * px * 1.2} fill={boneFill} stroke={boneStroke} strokeWidth="1" opacity=".85" />
      <path d={pathOf([g.patella.c, g.ins].map(img), false)} stroke={xray ? '#94A3B8' : '#E8D5BE'} strokeWidth={2.5 * g.k * px * 0.33} strokeOpacity=".5" strokeLinecap="round" fill="none" />
      <path d={pathOf(g.fibula.map(img), false)} stroke={xray ? '#94A3B8' : '#D8C6A8'} strokeWidth={3 * g.k * px * 0.33} strokeOpacity=".6" strokeLinecap="round" fill="none" />
      <circle cx={img(g.talus.c).x} cy={img(g.talus.c).y} r={g.talus.r * px} fill={boneFill} stroke={boneStroke} strokeWidth="1" opacity=".85" />
      {/* tibia: one piece, or shaft + plateau segment once there is an osteotomy */}
      {cut && O ? (
        <>
          <g clipPath={`url(#${uid}-dist)`}>
            {bone}
            {canal}
          </g>
          <g transform={`rotate(${-rotation} ${O.x} ${O.y})`} data-testid="plateau-segment">
            <g clipPath={`url(#${uid}-prox)`}>{bone}</g>
          </g>
        </>
      ) : (
        <>
          {bone}
          {canal}
        </>
      )}
      {plate}
      {/* calibration sphere (25 mm) */}
      {xray && (
        <circle cx={img(g.sphere.c).x} cy={img(g.sphere.c).y} r={g.sphere.r * px} fill="#F8FAFC" fillOpacity=".92" stroke="#FFFFFF" strokeWidth="1.5" />
      )}
      {xray && (
        <g>
          <rect x={vb.x + 14} y={vb.y + vb.h - 52} width="30" height="30" fill="#F8FAFC" />
          <text x={vb.x + 29} y={vb.y + vb.h - 29} fontSize="22" fontWeight="700" textAnchor="middle" fill="#000">L</text>
          <text x={vb.x + vb.w - 10} y={vb.y + 22} fontSize="14" fill="#94A3B8" textAnchor="end">ML 內外側投照・教學示意（非臨床影像）</text>
        </g>
      )}
      {children}
    </svg>
  );
}
