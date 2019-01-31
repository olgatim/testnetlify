(function(){
  const headerMenuButton = document.querySelector('.header__hamburger');
  const header = document.querySelector('.header');
  
  headerMenuButton.addEventListener('click', function(){
    header.classList.toggle('header--open');
  });
})();



(function(){
  $('.timer__wrapper ').countdown('2019/05/18 08:30:00', function(event) {
    $('.timer__month').html(event.strftime(`%m`));
    $('.timer__week').html(event.strftime('%W'));
    $('.timer__days').html(event.strftime('%d'));
    $('.timer__hours').html(event.strftime('%H'));
    $('.timer__minutes').html(event.strftime('%m'));
    $('.timer__second').html(event.strftime('%S'));
  });
})();