(function () {
  const headerMenuButton = document.querySelector(".header__hamburger");
  const header = document.querySelector(".header");

  headerMenuButton.addEventListener("click", function () {
    header.classList.toggle("header--open");
  });
})();

(function () {
  const finalDate = Date.parse("2019-05-18T08:30:00+02:00");

  $(".timer__wrapper").countdown(finalDate, function (event) {
    $(".timer__month").html(event.strftime("%m"));
    $(".timer__week").html(event.strftime("%W"));
    $(".timer__days").html(event.strftime("%d"));
    $(".timer__hours").html(event.strftime("%H"));
    $(".timer__minutes").html(event.strftime("%m"));
    $(".timer__second").html(event.strftime("%S"));
  });
})();

(function () {

  const DESKTOP_SCREEN_WIDTH = 1024;

  let controller = new ScrollMagic.Controller();

  if ($('.home-page').length) {
    const sectionArray = document.querySelectorAll("#schedule,#sponsor, #conduct");

    sectionArray.forEach(section => {
      new ScrollMagic.Scene({
        triggerElement: "#" + section.getAttribute("id"),
        triggerHook: 0.5,
        duration: section.offsetHeight
      })
        .setClassToggle(
          `a[href="#${section.getAttribute("id")}"]`,
          "menu__link--active"
        )
        .addTo(controller);
    });

    //scrolling navigation onClick

    const menuLinkArray = document.querySelectorAll(".menu__link");

    menuLinkArray.forEach(link => {
      link.addEventListener("click", function (event) {
        const id = this.getAttribute("href").slice(1);

        const activeLink = document.querySelector(".menu__link--active");

        if (activeLink) {
          activeLink.classList.remove("menu__link--active");
        }

        this.classList.add("menu__link--active");

        if (id.length > 0) {
          event.preventDefault();

          const headerHeight = 100;
          const scrollingPosition =
            document.getElementById(id).offsetTop - headerHeight;

          $("body, html").animate(
            {
              scrollTop: scrollingPosition
            },
            1000
          );

          if ($(document).width() < DESKTOP_SCREEN_WIDTH) {
            $(".header").removeClass("header--open");
          }
        }
      });
    });

    document.querySelector(".email").addEventListener("input", function () {
      document.querySelector(".venue__form--button").disabled = !this.validity.valid;
    });

  // mailchimp
  (function ($) {
    window.fnames = new Array();
    window.ftypes = new Array();
    fnames[0] = "EMAIL";
    ftypes[0] = "email";
  })(jQuery);
  var $mcj = jQuery.noConflict(true);
};

})();
