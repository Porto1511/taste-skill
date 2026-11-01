"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, Trash, PencilSimple, Check, X } from "@phosphor-icons/react";
import { addAreaAction, deleteAreaAction, moveAreaAction, renameAreaAction } from "@/server/actions/jobs";
import { idle, type ActionState } from "@/lib/action-state";
import type { OfficeJob } from "@/server/queries/office";
import { Input, Select } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/ui/form-client";
import { labels } from "@/lib/format";

export function AreasManager({ jobId, areas }: { jobId: string; areas: OfficeJob["areas"] }) {
  const [addState, addAction] = useActionState(addAreaAction, idle);
  const [delState, delAction] = useActionState(deleteAreaAction, idle);
  const addForm = useRef<HTMLFormElement>(null);
  useEffect(() => { if (addState.ok) addForm.current?.reset(); }, [addState]);
  return (
    <div className="grid gap-3">
      {areas.length === 0 && <p className="text-sm text-muted">No floors or phases yet. Add them to restrict drawings and people to parts of the job.</p>}
      <ul className="divide-y divide-line rounded-xl border border-line">
        {areas.map((a, i) => <AreaRow key={a.id} area={a} first={i === 0} last={i === areas.length - 1} delAction={delAction} />)}
      </ul>
      <FormMessage state={delState} />
      <form ref={addForm} action={addAction} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
        <input type="hidden" name="jobId" value={jobId} />
        <Input name="name" placeholder="e.g. Level 5 or Phase 3" aria-label="New area name" required maxLength={80} />
        <Select name="kind" defaultValue="floor" aria-label="Area type">
          {Object.entries(labels.areaKind).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <SubmitButton size="md" variant="dark" pendingText="Adding…">Add</SubmitButton>
      </form>
      <FormMessage state={addState} />
    </div>
  );
}

function AreaRow({ area, first, last, delAction }: { area: OfficeJob["areas"][number]; first: boolean; last: boolean; delAction: (f: FormData) => void }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await renameAreaAction(prev, form);
    if (result.ok) setEditing(false);
    return result;
  }, idle);
  const inUse = area.people + area.documents + area.reports > 0;
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      {editing ? (
        <form action={action} className="flex flex-1 items-center gap-2">
          <input type="hidden" name="areaId" value={area.id} />
          <Input name="name" defaultValue={area.name} autoFocus className="py-2" aria-label="Area name" />
          <button className="grid size-9 place-items-center rounded-lg bg-ink text-white" aria-label="Save"><Check className="size-4" weight="bold" /></button>
          <button type="button" onClick={() => setEditing(false)} className="grid size-9 place-items-center rounded-lg hover:bg-paper" aria-label="Cancel"><X className="size-4" /></button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{area.name} <span className="text-[12px] font-normal text-subtle">{labels.areaKind[area.kind]}</span></p>
            <p className="text-[12px] text-muted">{area.people} people · {area.documents} documents · {area.reports} reports</p>
          </div>
          <form action={moveAreaAction}><input type="hidden" name="areaId" value={area.id} /><input type="hidden" name="dir" value="up" />
            <button disabled={first} className="grid size-8 place-items-center rounded-lg hover:bg-paper disabled:opacity-25" aria-label={`Move ${area.name} up`}><ArrowUp className="size-4" /></button></form>
          <form action={moveAreaAction}><input type="hidden" name="areaId" value={area.id} /><input type="hidden" name="dir" value="down" />
            <button disabled={last} className="grid size-8 place-items-center rounded-lg hover:bg-paper disabled:opacity-25" aria-label={`Move ${area.name} down`}><ArrowDown className="size-4" /></button></form>
          <button type="button" onClick={() => setEditing(true)} className="grid size-8 place-items-center rounded-lg hover:bg-paper" aria-label={`Rename ${area.name}`}><PencilSimple className="size-4" /></button>
          <form action={delAction} onSubmit={(e) => { if (!confirm(`Remove ${area.name}?`)) e.preventDefault(); }}>
            <input type="hidden" name="areaId" value={area.id} />
            <button disabled={inUse} title={inUse ? "In use — remove its people, documents first" : "Remove"} className="grid size-8 place-items-center rounded-lg text-danger hover:bg-danger-soft disabled:text-subtle disabled:opacity-40" aria-label={`Remove ${area.name}`}><Trash className="size-4" /></button>
          </form>
        </>
      )}
      {state.error && <p className="text-[12px] text-danger">{state.error}</p>}
    </li>
  );
}
