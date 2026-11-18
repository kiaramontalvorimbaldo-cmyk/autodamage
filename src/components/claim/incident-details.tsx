'use client';

import {
  TIPOS_INCIDENTE,
  RESPUESTAS_INCIDENTE,
  type BorradorDetallesIncidente,
} from '@/application/validations/incident';

export function IncidentDetails({
  value,
  onChange,
}: {
  value: BorradorDetallesIncidente;
  onChange: (value: BorradorDetallesIncidente) => void;
}) {
  function change(key: keyof BorradorDetallesIncidente, text: string) {
    onChange({ ...value, [key]: text });
  }
  const style = 'mt-1 w-full rounded-md border bg-background px-3 py-2';
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm text-muted-foreground">
        Todos estos campos son obligatorios. Si desconoces un dato, elige «No lo sé».
      </legend>
      <label className="block">
        <span className="text-sm font-medium">Tipo de incidente</span>
        <select
          required
          value={value.tipo}
          onChange={(e) => change('tipo', e.target.value)}
          className={style}
        >
          <option value="">Selecciona una opción</option>
          {Object.entries(TIPOS_INCIDENTE).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Lugar de referencia</span>
        <input
          required
          minLength={5}
          maxLength={180}
          value={value.lugar}
          onChange={(e) => change('lugar', e.target.value)}
          placeholder="Calle o avenida, zona y un punto de referencia"
          className={style}
          aria-describedby="ayuda-lugar"
        />
      </label>
      <p id="ayuda-lugar" className="text-sm text-muted-foreground">
        Escribe el lugar del incidente; tu ubicación actual puede ser diferente.
      </p>
      <label className="block">
        <span className="text-sm font-medium">Descripción</span>
        <textarea
          required
          minLength={30}
          maxLength={900}
          value={value.relato}
          onChange={(e) => change('relato', e.target.value)}
          className={style}
          rows={3}
          aria-describedby="ayuda-relato"
        />
      </label>
      <p id="ayuda-relato" className="text-sm text-muted-foreground">
        Cuenta qué hacías, qué ocurrió y cómo quedó el vehículo. No incluyas contraseñas ni datos
        personales de terceros. Mínimo 30 caracteres ({value.relato.trim().length}/900).
      </p>
      <label className="block">
        <span className="text-sm font-medium">Daños observados</span>
        <textarea
          required
          minLength={10}
          maxLength={350}
          value={value.danos}
          onChange={(e) => change('danos', e.target.value)}
          placeholder="Por ejemplo: faro izquierdo roto y abolladura en el parachoques delantero"
          className={style}
          rows={2}
          aria-describedby="ayuda-danos"
        />
      </label>
      <p id="ayuda-danos" className="text-sm text-muted-foreground">
        Indica las partes afectadas y lo que ves. Si no identificas el daño, explícalo. Mínimo 10
        caracteres.
      </p>
      {(
        [
          ['otros_vehiculos', '¿Participaron otros vehículos?'],
          ['personas_heridas', '¿Hubo personas heridas?'],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block">
          <span className="text-sm font-medium">{label}</span>
          <select
            required
            value={value[key]}
            onChange={(e) => change(key, e.target.value)}
            className={style}
          >
            <option value="">Selecciona una opción</option>
            {Object.entries(RESPUESTAS_INCIDENTE).map(([answer, text]) => (
              <option key={answer} value={answer}>
                {text}
              </option>
            ))}
          </select>
        </label>
      ))}
    </fieldset>
  );
}
