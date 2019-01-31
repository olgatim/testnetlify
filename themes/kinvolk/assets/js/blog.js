new SlimSelect({
  select: '#tags-select',
  showSearch: false,
  valuesUseText: false,
  data: [
    {innerHTML: '<span class="all-posts-option">All CoreOS Posts</span>', text: 'All CoreOS Posts111', value: 'all-posts' },
    {innerHTML: '<span class="technical-posts-option">Technical Posts</span>', text: 'Technical Posts', value: 'technical' },
    {innerHTML: '<span class="announcements-posts-option">Announcements</span>', text: 'Announcements', value: 'announcements'}
  ]
})