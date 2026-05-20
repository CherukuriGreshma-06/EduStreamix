if (currentChapterData.resources && currentChapterData.resources.length > 0) {
  const resource = currentChapterData.resources[0];
  const link = resource.link;

  let videoId = '';

  if (link.includes('embed/')) {
    videoId = link.split('embed/')[1].split('?')[0];
  } else if (link.includes('v=')) {
    videoId = link.split('v=')[1].split('&')[0];
  }

  if (videoId) {
    videoData = {
      youtubeVideoId: videoId,
      title: currentChapterData.name + ' — ' + DISPLAY_SUBJECT
    };
  } else {
    window.open(link, '_blank');
    return;
  }
}