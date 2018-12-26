function findElement(selector) {
  return document.querySelector(selector);
};

findElement(".mobile-menu").addEventListener("click", function(event) {
  findElement("body").classList.toggle("mobile-menu_open");
  findElement("body").classList.remove("fixed");
  findElement(".header__navigation").addEventListener("transitionend", function() {
    if(findElement("body").classList.contains("mobile-menu_open")) {
      findElement("body").classList.add("fixed");
    }
  }, false);
});

document.querySelectorAll("div.navbar__link").forEach(function(item) {
  item.addEventListener("click", function(e) {
    if(!this.classList.contains("navbar__link_selected")) {
      document.querySelectorAll("div.navbar__link").forEach(function(elem) {
        elem.classList.remove("navbar__link_selected");
      });
      this.classList.add("navbar__link_selected");
    } else {
      this.classList.remove("navbar__link_selected");
    }
  })
});