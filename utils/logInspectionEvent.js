import { InspectionEvent } from "../Model/index.js";

export async function logInspectionEvent({
  inspection_id,
  po_id,
  actor_user_id,
  type,
  note = null,
  before = null,
  after = null,
  transaction = null
}) {
  return InspectionEvent.create({
    inspection_id,
    po_id,
    actor_user_id: actor_user_id ?? null,
    type,
    note,
    before,
    after
  }, transaction ? { transaction } : undefined);
}
