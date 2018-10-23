var controller = new ScrollMagic.Controller();

if(document.querySelector(".section-hero")) {
  var timeline = new TimelineMax();
  timeline
    .from(".section-hero-content", 0.7, {opacity: 0, y: -100, ease: Power0.easeNone}, 0)
  
  new ScrollMagic.Scene({
    triggerElement: '.section-hero',
    triggerHook: 0.8,
    reverse: false
  })
    .setClassToggle('.section-hero', 'show')
    .setTween(timeline)
    .addTo(controller);
}

