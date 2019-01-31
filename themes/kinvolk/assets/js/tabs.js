function initTabs(navItem, tabItem) {
  var tabLinksArr = document.querySelectorAll(navItem);

  tabLinksArr.forEach(function (tabLink) {
    tabLink.addEventListener('click', function () {
      switchTabs(this, tabItem, navItem);
    })
  });
};

function switchTabs(currentItem, tabItem, navItem) {
  var tabNum;

  if (currentItem.classList.contains('active')) {
    return;
  }
  findElement(navItem + ".active").classList.remove('active');
  currentItem.classList.add('active');
  tabNum = currentItem.getAttribute('data-tab-link');
  findElement(tabItem + '.active').classList.remove('active');
  findElement('[data-tab=' + '"' + tabNum + '"' + ']').classList.add('active');
};