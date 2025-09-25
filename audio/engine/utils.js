export const convertSuperpoweredTimeline = (superpoweredTimelineData) => {
  superpoweredTimelineData.tracks.map((t) => {
    if (!t.actions) {
      t.actions = JSON.parse(JSON.stringify([...t.regions]));
      delete t.regions;
    }
    return t;
  });
  return superpoweredTimelineData;
};
