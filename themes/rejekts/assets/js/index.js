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

})();
