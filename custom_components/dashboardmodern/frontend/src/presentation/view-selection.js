export function validViews(dashboard) {
  return Array.isArray(dashboard?.views) ? dashboard.views.filter((view) => view?.id) : [];
}

export function selectActiveViewId(dashboard, previousActiveViewId = null) {
  const views = validViews(dashboard);
  if (previousActiveViewId && views.some((view) => view.id === previousActiveViewId)) return previousActiveViewId;
  return views[0]?.id || null;
}
