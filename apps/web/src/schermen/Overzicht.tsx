import { api, type Gebruiker, type PatientOverzicht } from '../api';
import { useData } from '../gebruik';
import { Icoon, icoonVanModule } from '../iconen';
import { Fout, Kaart, Laden, Signalen } from '../onderdelen';
import { Zorgreis } from '../zorgreis';

const NADRUK_ICOON: Record<string, string> = {
  wie: 'persoon', speelt: 'doel', hoe: 'grafiek', zelfredzaamheid: 'schild',
  jaar: 'boek', open: 'klembord', grenzen: 'beperking',
};

/**
 * HET OVERZICHT
 *
 * Wie een dossier opent dat hij niet kent, stelt eerst één vraag: wie is dit en wat
 * speelt er? Dat antwoord stond verspreid over acht kaarten in het consultscherm, en werd
 * door elke zorgverlener opnieuw samengesteld door te lezen — bij elke waarnemer opnieuw.
 *
 * Dit tabblad geeft dat antwoord. Het legt niets vast: het is bewust alleen lezen, zodat
 * je hier kunt landen zonder dat een half ingevuld formulier meekijkt.
 *
 * Wie liever direct in het consult begint, zet dat om in Mijn voorkeuren. Er zijn artsen
 * die dit overzicht niet willen zien en meteen willen registreren, en die hebben gelijk
 * voor hun manier van werken.
 */
export function Overzicht({ patientId, gebruiker, opTab, openPatient }: {
  patientId: string;
  gebruiker: Gebruiker;
  opTab: (tab: string) => void;
  openPatient?: (id: string) => void;
}) {
  const overzicht = useData(() => api.patient(patientId), [patientId]);
  const vatting = useData(() => api.samenvatting(patientId), [patientId]);

  if (overzicht.fout) return <Fout boodschap={overzicht.fout} />;
  if (overzicht.bezig || !overzicht.data || !vatting.data) return <Laden wat="Overzicht" />;

  const data: PatientOverzicht = overzicht.data;
  const plan = data.zorgplan;
  const vandaag = new Date().toISOString().slice(0, 10);
  const laatsteContact = data.metingen
    .map((m) => m.op).filter((op): op is string => Boolean(op)).sort().at(-1);

  return (
    <div className="raster2" style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)' }}>
      <div>
        <Kaart titel="In het kort" icoon="boek"
          extra={
            <span className="mini" style={{ marginLeft: 'auto' }}>
              samengesteld uit het dossier · v{vatting.data.herkomst.versie}
            </span>
          }>
          {vatting.data.alineas.map((alinea) => (
            <div key={alinea.id} className="alinea" data-nadruk={alinea.nadruk}>
              <div className="kop">
                <span className="ikoon">
                  <Icoon naam={NADRUK_ICOON[alinea.id] ?? 'doel'} grootte={14} />
                </span>
                <h3>{alinea.titel}</h3>
              </div>
              <p>{alinea.tekst}</p>
              <div className="bron">
                <span>Op basis van {alinea.bron}</span>
              </div>
            </div>
          ))}

          {/*
            Eerlijk over wat dit is. Een gegenereerde samenvatting stuurt waar de
            zorgverlener naar kijkt, en dat is beslissingsondersteuning — ook als hij
            met regels is gemaakt in plaats van met een taalmodel.
          */}
          <div className="notitie" style={{ marginTop: 12 }}>
            <strong>Hoe dit tot stand komt.</strong> {vatting.data.herkomst.toelichting}
          </div>
        </Kaart>

        <Kaart titel="Waar staat deze patiënt" icoon="reis"
          telling={`${plan.contacten.length} contacten gepland`}>
          <Zorgreis contacten={plan.contacten} vandaag={vandaag} laatsteContact={laatsteContact} />
          <button className="knop" style={{ marginTop: 11 }} onClick={() => opTab('consult')}>
            <Icoon naam="klembord" grootte={13} /> Naar het consult
          </button>
        </Kaart>
      </div>

      <div>
        <Kaart titel="Kerngetallen" icoon="rapport">
          <div className="kengetallen" style={{ marginBottom: 0 }}>
            {vatting.data.kerngetallen.map((k) => (
              <div key={k.label} className="kengetal" data-toon={k.toon}>
                <div className="getal">{k.waarde}</div>
                <div className="label">{k.label}</div>
                {k.onder && <div className="mini">{k.onder}</div>}
              </div>
            ))}
          </div>
        </Kaart>

        <Kaart titel="Aandachtsgebieden" icoon="doel" telling={plan.modules.length}>
          {plan.modules.length === 0 && (
            <span className="mini">Geen actieve aandachtsgebieden.</span>
          )}
          {plan.modules.map((module) => (
            <div key={module.id} className={`modulekaart mod-${module.id}`}>
              <div className="kop">
                <span style={{ color: 'var(--tint)' }}>
                  <Icoon naam={icoonVanModule(module.id, module.icoon)} />
                </span>
                <h3>{module.naam}</h3>
              </div>
              <div className="reden">{module.onderbouwing}</div>
            </div>
          ))}
        </Kaart>

        <Kaart titel="Signalen" icoon="waarschuwing">
          <Signalen signalen={data.signalen} />
        </Kaart>

        <Kaart titel="Snel naar" icoon="pijl">
          <div className="orderknoppen">
            <button className="knop" onClick={() => opTab('journaal')}>
              <Icoon naam="boek" grootte={13} /> Journaal
            </button>
            <button className="knop" onClick={() => opTab('metingen')}>
              <Icoon naam="buisje" grootte={13} /> Meetwaarden
            </button>
            <button className="knop" onClick={() => opTab('media')}>
              <Icoon naam="document" grootte={13} /> Media
            </button>
            <button className="knop" onClick={() => opTab('orders')}>
              <Icoon naam="pil" grootte={13} /> Orders
            </button>
          </div>
          {openPatient && gebruiker.rechten.includes('dossier-schrijven') && (
            <span className="mini" style={{ display: 'block', marginTop: 9 }}>
              Vastleggen doe je in het consult.
            </span>
          )}
        </Kaart>
      </div>
    </div>
  );
}
