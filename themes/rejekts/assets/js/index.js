(function(){
  const headerMenuButton = document.querySelector('.header__hamburger');
  const header = document.querySelector('.header');
  
  headerMenuButton.addEventListener('click', function(){
    header.classList.toggle('header--open');
  });
})();

(function(){
  
  const finalDate = Date.parse('2019-05-18T08:30:00+02:00');

  $('.timer__wrapper ').countdown(finalDate, function(event) {
    $('.timer__month').html(event.strftime(`%m`));
    $('.timer__week').html(event.strftime('%W'));
    $('.timer__days').html(event.strftime('%d'));
    $('.timer__hours').html(event.strftime('%H'));
    $('.timer__minutes').html(event.strftime('%m'));
    $('.timer__second').html(event.strftime('%S'));
  });
})();

(function(){

  const PARALLAX_MAX_SCREEN_WIDTH = 1024

  if($(document).width() >= PARALLAX_MAX_SCREEN_WIDTH){
    function parallaxIt(e,container, target, movement) {
      var $this = $(container);
      var relX = e.pageX - $this.offset().left;
      var relY = e.pageY - $this.offset().top;
    
      TweenMax.to(target, 1, {
        x: (relX - $this.width() / 2) / $this.width() * movement,
        y: (relY - $this.height() / 2) / $this.height() * movement,
        rotationX:(relX - $this.width() / 2) / $this.width() * movement * 0.5,
        rotationY:(relY - $this.height() / 2) / $this.height() * movement * 0.5
      });
    }
  
    $(".hero__image-wrapper").mousemove(function(e) {
      parallaxIt(e,".hero__image-wrapper", ".hero__image", 30);
      parallaxIt(e,".hero__image-wrapper", ".hero__background-dots", 20);
      parallaxIt(e,".hero__image-wrapper", ".hero__background-x", 50);
    });
  
    $(".event-schedule__title-wrapper").mousemove(function(e) {
      parallaxIt(e,".event-schedule__title-wrapper", ".event-schedule__title-wrapper img", 10);
      parallaxIt(e,".event-schedule__title-wrapper", ".event-schedule__title", 15);
    });
  
    $(".morals__title-wrapper").mousemove(function(e) {
      parallaxIt(e,".morals__title-wrapper", ".morals__title-wrapper img", -10);
      parallaxIt(e,".morals__title-wrapper", ".morals__title", -15);
    });
  
    $(".morals__image-wrapper").mousemove(function(e) {
      parallaxIt(e,".morals__image-wrapper", ".morals__background-image", -30);
      parallaxIt(e,".morals__image-wrapper", ".morals__picture", -20);
    });
  }

  //ScrollMagic
  

  let controller = new ScrollMagic.Controller();

  const sectionArray = document.querySelectorAll("#schedule, #conduct");

  sectionArray.forEach( section => {
    new ScrollMagic.Scene({
      triggerElement: '#' + section.getAttribute('id'),
      triggerHook: 0.5,
      duration: section.offsetHeight
    })
      .setClassToggle('a[href="#' + section.getAttribute('id') + '"]', 'menu__link--active')
      .addTo(controller);
  })

  //scrolling navigation onClick

  const menuLinkArray = document.querySelectorAll(".menu__link");

  menuLinkArray.forEach( link => {
    link.addEventListener("click", function(event){
      const id = this.getAttribute("href").slice(1);

      const activeLink = document.querySelector('.menu__link--active');

      if (activeLink) {
        activeLink.classList.remove('menu__link--active');
      }

      this.classList.add('menu__link--active');

      if( id.length > 0) {
        event.preventDefault();

        const headerHeight = 100;
        const scrollingPosition = document.getElementById(id).offsetTop - headerHeight;;

        $("body, html").animate({scrollTop:scrollingPosition}, 1000);

        const DESKTOP_SCREEN_WIDTH = 1024;

        if($(document).width() < DESKTOP_SCREEN_WIDTH ) {
          document.querySelector('.header').classList.remove("header--open");
        }
      }
    })
  })

})();
