import { cases } from '../data';
import { PatientView, limbsFromSide } from '../components/PatientView';

/** Dev-only visual QA page (#/gallery in `npm run dev`); not part of the production build. */
export function PatientGallery() {
  return (
    <div className="grid cols-3">
      {cases.map((c) => (
        <figure key={c.id} className="card" style={{ margin: 0 }} data-testid={`gallery-${c.id}`}>
          <PatientView species={c.species} breed={c.breed} pose={c.pose} affectedLimbs={limbsFromSide(c.side)} size={300} />
          <figcaption className="small">
            {c.id}・{c.species}・{c.breed}・{c.side}・{c.pose}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
