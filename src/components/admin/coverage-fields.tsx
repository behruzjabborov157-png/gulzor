/**
 * Districts a delivery zone serves (checkboxes). Read on the server with coverageFromForm().
 * Nothing ticked = the zone serves the whole city / region.
 */
export function CoverageFields({ districts, selected, idPrefix }: { districts: { id: number; name: string }[]; selected: number[]; idPrefix: string }) {
  if (!districts.length) return null;
  const chosen = new Set(selected);
  return (
    <fieldset className="rounded-xl border border-line p-3">
      <input type="hidden" name="coverage" value="1" />
      <legend className="px-1 text-xs font-medium text-muted">
        Qaysi tumanlarga yetkaziladi {chosen.size ? `(${chosen.size} ta)` : "(belgilanmasa — hammasiga)"}
      </legend>
      <div className="grid max-h-64 gap-x-4 gap-y-1.5 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
        {districts.map((d) => (
          <label key={d.id} htmlFor={`${idPrefix}-d${d.id}`} className="flex items-center gap-2 text-sm">
            <input id={`${idPrefix}-d${d.id}`} type="checkbox" name="districtIds" value={d.id} defaultChecked={chosen.has(d.id)} className="h-4 w-4 accent-wine" />
            {d.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
