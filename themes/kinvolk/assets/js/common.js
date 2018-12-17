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