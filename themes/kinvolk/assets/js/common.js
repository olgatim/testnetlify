$('.mobile-menu').on('click', function(e) {
  $('body').toggleClass("mobile-menu_open");
});

  document.querySelectorAll(".nav-link").forEach(function(item) {
    item.addEventListener("click", function(e) {
      if($("body").hasClass("mobile-menu_open")) {
        e.preventDefault();
        if(!this.classList.contains("nav-link_selected")) {
          document.querySelectorAll(".nav-link").forEach(function(elem) {
            elem.classList.remove("nav-link_selected");
          });
          this.classList.add("nav-link_selected");
        } else {
          this.classList.remove("nav-link_selected");
        }
      }
    })
  });


