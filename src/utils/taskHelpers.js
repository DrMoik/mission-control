export function getTaskAssigneeIds(task) {
  return task?.assigneeMembershipIds ?? (task?.assigneeMembershipId ? [task.assigneeMembershipId] : []);
}

export function getPrimaryTaskAssigneeId(task) {
  return getTaskAssigneeIds(task)[0] ?? null;
}
