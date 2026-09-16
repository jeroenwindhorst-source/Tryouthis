import { MODULE_NAAM, type GeplandContact } from './api';
import { Icoon, icoonVanModule } from './iconen';

const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const kort = (datum: string) => {
  const d = new Date(datum);
  return `${d.getDate()} ${MAAND[d.getMonth()]}`;
};

const jaarVan = (datum: string) => datum.slice(0, 4);

/**
 * DE ZORGREIS
 *
 * Het plan stond er al — als tekst, met per contact een datum, een duur en een lijst
 * metingen. Volledig, maar je moest het lézen om te zien waar iemand in zijn jaar staat.
 * En dat is precies de vraag die in een consult als eerste opkomt: wanneer heb ik deze
 * mens gezien, wanneer zie ik hem weer, en wat gebeurt er tussendoor?
 *
 * Daarom een tijdlijn in plaats van een lijst. Wat hier staat is hetzelfde plan, maar in
 * de vorm waarin de vraag gesteld wordt. De tekstuele uitwerking blijft eronder staan:
 * een plaatje zonder onderbouwing is een aanname, en dit plan is te consequentieel om op
 * een vormpje te vertrouwen.
 *
 * Bewust geen voortgangsbalk of percentage. Een chronische aandoening heeft geen eindpunt
 * en een balk die voor 60% vol staat suggereert dat er ergens een 100% is.
 */
export function Zorgreis({ contacten, laatsteContact, vandaag, opContact }: {
  contacten: GeplandContact[];
  /** Datum van het laatste vastgelegde contact, als dat er is. */
  laatsteContact?: string;
  vandaag: string;
  opContact?: (contactId: string) => void;
}) {
  if (contacten.length === 0) {
    return (
      <p className="mini">
        Geen geplande contacten. Bij deze patiënt vraagt het protocol op dit moment niets.
      </p>
    );
  }

  const laatste = contacten.at(-1)!;
  const maanden = Math.max(
    1,
    Math.round(
      (new Date(laatste.datum).getTime() - new Date(vandaag).getTime()) / (30.4 * 86_400_000),
    ),
  );

  return (
    <div className="zorgreis">
      <div className="kop">
        <span className="mini">
          De komende {maanden} maanden · {contacten.length} contact
          {contacten.length === 1 ? '' : 'en'} ·{' '}
          {contacten.reduce((som, c) => som + c.duurMinuten, 0)} minuten samen
        </span>
      </div>

      <ol className="rail">
        {laatsteContact && (
          <li className="halte verleden">
            <span className="stip" />
            <div className="wanneer">
              {kort(laatsteContact)}
              <div className="mini">{jaarVan(laatsteContact)}</div>
            </div>
            <div className="inhoud">
              <strong>Laatste contact</strong>
              <div className="mini">vastgelegd in het journaal</div>
            </div>
          </li>
        )}

        <li className="halte nu">
          <span className="stip" />
          <div className="wanneer">
            {kort(vandaag)}
            <div className="mini">vandaag</div>
          </div>
          <div className="inhoud">
            <strong>Nu</strong>
            <div className="mini">dit consult</div>
          </div>
        </li>

        {contacten.map((contact, i) => (
          <li key={contact.id} className="halte"
            data-soort={contact.soort}
            data-klikbaar={Boolean(opContact)}
            onClick={opContact ? () => opContact(contact.id) : undefined}>
            <span className="stip" />
            <div className="wanneer">
              {kort(contact.datum)}
              <div className="mini">{jaarVan(contact.datum)}</div>
            </div>
            <div className="inhoud">
              <div className="titel">
                <strong>
                  {contact.soort === 'uitgebreide-controle' ? 'Uitgebreide controle' : 'Controle'}
                </strong>
                <span className="mini">
                  <Icoon naam="klok" grootte={11} /> {contact.duurMinuten} min
                </span>
                {i === 0 && <span className="merkje" data-toon="informatief">eerstvolgend</span>}
              </div>

              <div className="modulestippen">
                {contact.modules.map((id) => (
                  <span key={id} className={`modulestip mod-${id}`} title={MODULE_NAAM[id] ?? id}>
                    <Icoon naam={icoonVanModule(id)} grootte={11} />
                    {MODULE_NAAM[id] ?? id}
                  </span>
                ))}
              </div>

              {(contact.labVooraf.length > 0 || contact.vragenlijsten.length > 0) && (
                <div className="vooraf">
                  {contact.labVooraf.length > 0 && (
                    <span className="mini">
                      <Icoon naam="buisje" grootte={11} /> lab vooraf: {contact.labVooraf.join(', ')}
                    </span>
                  )}
                  {contact.vragenlijsten.length > 0 && (
                    <span className="mini">
                      <Icoon naam="gesprek" grootte={11} /> vragenlijst: {contact.vragenlijsten.join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
