class CarouselCustom extends HTMLElement {
  constructor() {
    super()

    this.direction = this.getAttribute("direction")?.toUpperCase() || (this.hasAttribute("reverse") && "RIGHT") || "LEFT";
    this.delay = this.getAttribute("animation-delay") ? parseFloat(this.getAttribute("animation-delay")) : 5;
    this.animationLength = this.getAttribute("animation-length") ? parseFloat(this.getAttribute("animation-length")) : 1;
    if(this.delay <= this.animationLength) {
      console.warn(`Animation delay shorter than or equal to animation length time\nUsed default values instead.`);
      this.delay = 5;
      this.animationLength = 1;
    }

    this.shadow = this.attachShadow({ mode: 'closed' });
    this.wrapper = document.createElement('div');
    this.pics = Array.from(this.children).filter(p => p instanceof HTMLImageElement);

    if (this.pics.length == 0) return;

    this.selectors = [];
    this.innerHTML = '';

    this.shadow.innerHTML = `
    <style>
      img {
        max-width: 100%;
        max-height: 100%;
      }
      .wrapper {
        overflow: hidden;
        position: relative;
        height: 100%;
        width: 100%;
      }
      .img-holder {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .slide {
        animation: sliding ${this.animationLength}s ease-in-out;
        -o-animation: sliding ${this.animationLength}s ease-in-out;
        -moz-animation: sliding ${this.animationLength}s ease-in-out;
        -webkit-animation: sliding ${this.animationLength}s ease-in-out;
      }
      .to-left              { --start:  0;    --end: -100%; }
      .to-center-from-right { --start:  100%; --end:  0;    } 
      .to-right             { --start:  0;    --end:  100%; }
      .to-center-from-left  { --start: -100%; --end:  0;    }
      .move-arrow {
        --border: 0.25rem solid black;
        position: absolute;
        z-index: 10;
        border: none;
        background-color: transparent;
        border-top: var(--border);
        border-left: var(--border);
        top:50%;
        transform: translateY(-50%) rotate(var(--rotation));
        width: 20px;
        height: 20px;
        cursor: pointer;
      }
      .move-arrow:first-of-type {
        --rotation: -45deg;
        left: 5px;
      }
      .move-arrow:last-of-type {
        --rotation: 135deg;
        right: 5px;
      }
      .picker-wrapper {
        z-index: 10;
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        margin: auto 0;
        padding-bottom: 5px;
      }
      .picker-wrapper * {
        padding: 0;
        margin: 0;
      } 
      .picker-wrapper > div {
        border-radius: 50%;
        margin: 2px;
        width: 15px;
        height: 15px;
        background-color: rgb(0,0,0);
        opacity: 0.3;
        transition: opacity ${this.animationLength}s;
      }     
      .picker-wrapper > div.selected {
        opacity: 1;
      }
      @keyframes sliding {
        from { transform: translateX(var(--start)) }
        to { transform: translateX(var(--end)) }
      }
    </style>
    `

    Promise
      .allSettled(this.pics.map(p => p.decode()))
      .then(results => {
        this.pics = this.pics.map((picture, index) => {
          if (results[index].status === "fulfilled") {
            const d = document.createElement("div");
            d.classList.add("img-holder")
            d.appendChild(picture)
            return d
          } else {
            console.warn(`Image with url ${picture.src} (img n°${index + 1}) could not load \n`, results[index].reason);
            return null
          }
        }).filter(p => !!p);

        this.pics[0].shown = true;
        this.wrapper.appendChild(this.pics[0]);
        this.wrapper.classList.add("wrapper");
        this.shadow.appendChild(this.wrapper);

        if (this.pics.length > 1) {
          function buttonEvent({ direction, target }) {
            if (this.working) return;
            if (this.pics.findIndex(p => p.shown) === target) return;

            this.working = true;
            clearInterval(this.interval);
            this.move({ direction, target });
            this.interval = setInterval(this.move.bind(this), this.delay * 1000);
          }

          this.leftBtn = document.createElement("button");
          this.leftBtn.classList.add("move-arrow");
          this.leftBtn.addEventListener("click", buttonEvent.bind(this, { direction: "RIGHT" }));

          this.rightBtn = this.leftBtn.cloneNode(true);
          this.rightBtn.addEventListener("click", buttonEvent.bind(this, { direction: "LEFT" }));

          this.picker = document.createElement("div");
          this.picker.classList.add("picker-wrapper");

          this.pics.forEach((_, index) => {
            const i = document.createElement("div");
            i.addEventListener("click", buttonEvent.bind(this, { target: index }));
            this.selectors.push(i);
            this.picker.appendChild(i);
          });
          this.selectors[0].classList.toggle("selected");

          this.wrapper.appendChild(this.leftBtn);
          this.wrapper.appendChild(this.picker);
          this.wrapper.appendChild(this.rightBtn);

          this.interval = setInterval(this.move.bind(this), this.delay * 1000);
        }
      });
  }

  removePic(index, direction) {
    this.pics[index].classList.add("slide", direction);

    const f = () => {
      this.clearAnimationClasses(this.pics[index]);
      this.wrapper.removeChild(this.pics[index]);

      this.pics[index].removeEventListener("webkitAnimationEnd", f);
      this.pics[index].removeEventListener("animationend", f);
      this.pics[index].shown = false;
      this.working = false;
    }

    this.pics[index].addEventListener("webkitAnimationEnd", f);
    this.pics[index].addEventListener("animationend", f);
    this.selectors[index].classList.toggle("selected");
  }

  setPic(index, direction) {
    this.wrapper.appendChild(this.pics[index]);
    this.pics[index].classList.add("slide", direction);

    const f = () => {
      this.clearAnimationClasses(this.pics[index]);

      this.pics[index].removeEventListener("webkitAnimationEnd", f);
      this.pics[index].removeEventListener("animationend", f);
      this.pics[index].shown = true;
      this.working = false;
    }

    this.pics[index].addEventListener("webkitAnimationEnd", f);
    this.pics[index].addEventListener("animationend", f);
    this.selectors[index].classList.toggle("selected");
  }

  move({ direction = this.direction, target = null } = {}) {
    if (document.hidden) return // Prevents errors if user changes tabs
    this.working = true;

    const oldPicIndex = this.pics.findIndex(p => p.shown);
    const newPicIndex = typeof target === "number"
      ? target
      : (
        oldPicIndex + this.pics.length + (direction === "RIGHT" ? - 1 : 1)
      ) % this.pics.length;

    if (typeof target === "number") direction = oldPicIndex > newPicIndex ? "RIGHT" : "LEFT";

    this.removePic.call(
      this,
      oldPicIndex,
      direction === "RIGHT" ? "to-right" : "to-left"
    )
    this.setPic.call(
      this,
      newPicIndex,
      direction === "RIGHT" ? "to-center-from-left" : "to-center-from-right"
    )
  }

  clearAnimationClasses(elem) {
    elem.classList.remove("slide", "to-left", "to-center-from-right", "to-right", "to-center-from-left");
  }
}

customElements.define("carousel-custom", CarouselCustom)
