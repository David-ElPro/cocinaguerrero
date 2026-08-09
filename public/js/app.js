document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let clientSlug = urlParams.get("c");

    if (!clientSlug) {
        const segments = window.location.pathname
            .split("/")
            .filter(s => s && s !== "index.html" && s !== "public" && !s.includes("."));
        const last = segments[segments.length - 1];
        clientSlug = (!last || last.toLowerCase() === "cocinaguerrero") ? "cocina-guerrero" : last;
    }

    try {
        const response = await fetch(`./data/${clientSlug}.json`);
        if (!response.ok) throw new Error("Cliente no encontrado");

        const data = await response.json();

        // 1. Inyección de Información Básica
        document.title = `${data.nombre} | Menú Digital`;
        document.getElementById("client-logo").src = data.logo;
        document.getElementById("client-title").textContent = data.nombre;
        document.getElementById("hero-title").textContent = data.nombre;
        document.getElementById("client-subtitle").textContent = data.eslogan;
        document.getElementById("footer-slogan").textContent = data.eslogan;
        document.getElementById("client-schedule").innerHTML = `<i class="fa-solid fa-clock"></i> ${data.horario}`;
        document.getElementById("footer-address").innerHTML = `<i class="fa-solid fa-location-dot"></i> ${data.direccion}`;

        // Teléfonos y Redes
        document.getElementById("tel-1").textContent = data.whatsapp;
        document.getElementById("tel-1").href = `tel:${data.whatsapp}`;
        document.getElementById("tel-2").textContent = data.telefonoSecundario;
        document.getElementById("tel-2").href = `tel:${data.telefonoSecundario}`;

        document.getElementById("gmb-link").href = data.googleBusiness;
        document.getElementById("mp-link").href = data.mercadoPago;
        document.getElementById("promo-video").src = data.videoUrl;

        document.getElementById("txt-mision").textContent = data.mision;
        document.getElementById("txt-vision").textContent = data.vision;

        if (data.redes) {
            document.getElementById("social-fb").href = data.redes.facebook;
            document.getElementById("social-ig").href = data.redes.instagram;
            document.getElementById("social-tw").href = data.redes.twitter;
        }

        // 2. Configurar Botones Principales de WhatsApp
        const waPhone = data.whatsapp;
        const msgGeneral = encodeURIComponent("¡Hola Cocina Guerrero! Me gustaría hacer un pedido.");
        const msgGuisados = encodeURIComponent("¡Hola! Quisiera consultar los guisados del día de hoy.");

        document.getElementById("btn-hero-wa").href = `https://wa.me/${waPhone}?text=${msgGeneral}`;
        document.getElementById("btn-daily-wa").href = `https://wa.me/${waPhone}?text=${msgGuisados}`;
        document.getElementById("btn-wa-float").href = `https://wa.me/${waPhone}?text=${msgGeneral}`;

        // 3. Hero Carousel Rotativo
        if (data.carousel && data.carousel.length > 0) {
            const carouselBg = document.getElementById("carousel-bg");
            let idx = 0;
            carouselBg.style.backgroundImage = `url('${data.carousel[0]}')`;
            setInterval(() => {
                idx = (idx + 1) % data.carousel.length;
                carouselBg.style.backgroundImage = `url('${data.carousel[idx]}')`;
            }, 4000);
        }

        // 4. Renderizar Catálogo de Platillos
        const catalogContainer = document.getElementById("catalog-container");
        catalogContainer.innerHTML = "";

        data.categorias.forEach((cat) => {
            const section = document.createElement("section");

            let itemsHTML = cat.items.map(item => {
                const itemMsg = encodeURIComponent(`¡Hola Cocina Guerrero! Quisiera pedir una orden de: ${item.nombre}`);
                const waItemUrl = `https://wa.me/${waPhone}?text=${itemMsg}`;

                return `
          <div class="food-card">
            <div>
              <div class="card-img-wrapper">
                <img src="${item.imagen}" alt="${item.nombre}" loading="lazy">
                ${item.badge ? `<span class="card-badge">${item.badge}</span>` : ""}
              </div>
              <div class="card-body">
                <h4 class="card-title">${item.nombre}</h4>
                <p class="card-desc">${item.descripcion}</p>
              </div>
            </div>
            <div class="card-body" style="padding-top:0;">
              <div class="card-footer">
                <span class="card-price">${item.precio}</span>
                <a href="${waItemUrl}" target="_blank" class="btn-card-wa">
                  <i class="fa-brands fa-whatsapp"></i> Pedir ahora
                </a>
              </div>
            </div>
          </div>
        `;
            }).join('');

            section.innerHTML = `
        <div class="category-header">
          <h3 class="category-title"><i class="fa-solid fa-utensils"></i> ${cat.titulo}</h3>
          ${cat.nota ? `<p class="category-note">${cat.nota}</p>` : ""}
        </div>
        <div class="cards-grid">${itemsHTML}</div>
      `;

            catalogContainer.appendChild(section);
        });

        // 5. Renderizar y Controlar Carrusel de Testimonios
        const testimonialsData = [
            { nombre: "Karla M.", texto: "La milanesa y el agua del día están riquísimas. El servicio por WhatsApp es super rápido.", imagen: "./img/test1.webp" },
            { nombre: "María Fernanda G.", texto: "El pozole de los jueves es una joya. Sabor súper casero y las porciones muy bien servidas.", imagen: "./img/test2.jpg" },
            { nombre: "Roberta H.", texto: "Excelente opción para comer rico y a buen precio todos los días en la oficina.", imagen: "./img/test3.jpg" },
            { nombre: "Andrea P.", texto: "Las cecina y las enchiladas verdes están excelentes. Se nota la higiene y frescura.", imagen: "./img/test4.jpg" },
            { nombre: "Luisa.", texto: "Las gorditas de chales con pollo encima son adictivas. Súper recomendado.", imagen: "./img/test5.jpg" },
            { nombre: "Lucía B.", texto: "Gran sazón, el envío por WhatsApp me ahorra muchísimo tiempo a la hora de comer.", imagen: "./img/test6.jpg" }
        ];

        const testiTrack = document.getElementById("testi-track");
        testiTrack.innerHTML = testimonialsData.map(t => `
      <div class="testimonial-card">
        <div class="testi-stars">
          <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
        </div>
        <p>"${t.texto}"</p>
        <span>- ${t.nombre}</span>
        <div class="testi-avatar">
          ${t.imagen ? `<img src="${t.imagen}" alt="${t.nombre}" loading="lazy">` : `<i class="fa-solid fa-circle-user"></i>`}
        </div>
      </div>
    `).join('');

        let currentTesti = 0;
        const prevBtn = document.getElementById("prev-testi");
        const nextBtn = document.getElementById("next-testi");

        const updateTestiSlide = () => {
            const card = document.querySelector(".testimonial-card");
            if (card) {
                const cardWidth = card.offsetWidth + 16;
                testiTrack.style.transform = `translateX(-${currentTesti * cardWidth}px)`;
            }
        };

        nextBtn.addEventListener("click", () => {
            currentTesti = (currentTesti + 1) % testimonialsData.length;
            updateTestiSlide();
        });

        prevBtn.addEventListener("click", () => {
            currentTesti = (currentTesti - 1 + testimonialsData.length) % testimonialsData.length;
            updateTestiSlide();
        });

        // Auto-play de testimonios cada 5 segundos
        setInterval(() => {
            currentTesti = (currentTesti + 1) % testimonialsData.length;
            updateTestiSlide();
        }, 5000);

        // 6. Mobile Navbar Toggle & Click Outside to Close
        const navToggle = document.getElementById("nav-toggle");
        const navMenu = document.getElementById("nav-menu");

        navToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            navMenu.classList.toggle("active");
            navToggle.classList.toggle("active");
        });

        document.addEventListener("click", (e) => {
            if (navMenu.classList.contains("active")) {
                if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
                    navMenu.classList.remove("active");
                    navToggle.classList.remove("active");
                }
            }
        });

        // Cerrar menú al presionar un enlace
        document.querySelectorAll(".nav-link").forEach(link => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("active");
                navToggle.classList.remove("active");
            });
        });

        // 7. Tooltip de WhatsApp Flotante (Se oculta en 5 segundos)
        setTimeout(() => {
            const tooltip = document.getElementById("wa-tooltip");
            if (tooltip) {
                tooltip.style.transition = "opacity 0.5s ease";
                tooltip.style.opacity = "0";
                setTimeout(() => tooltip.remove(), 500);
            }
        }, 5000);
        // 8. Botones Flotantes de Redes Sociales Desplegables
        const socialToggleBtn = document.getElementById("social-toggle-btn");
        const socialContainer = document.getElementById("social-floatings-container");
        let socialOpen = false;

        // Sincronicar URLs de redes sociales
        if (data.redes) {
            document.getElementById("social-float-fb").href = data.redes.facebook || "#";
            document.getElementById("social-float-ig").href = data.redes.instagram || "#";
            document.getElementById("social-float-tw").href = data.redes.twitter || "#";
        }

        socialToggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            socialOpen = !socialOpen;
            if (socialOpen) {
                socialContainer.classList.add("open");
                socialToggleBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
            } else {
                socialContainer.classList.remove("open");
                socialToggleBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';
            }
        });

        // Cerrar al hacer click fuera
        document.addEventListener("click", (e) => {
            if (socialOpen && !socialContainer.contains(e.target) && !socialToggleBtn.contains(e.target)) {
                socialOpen = false;
                socialContainer.classList.remove("open");
                socialToggleBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';
            }
        });
        // Revelar App
        document.getElementById("app").style.display = "block";

    } catch (err) {
        console.error(err);
        document.body.innerHTML = `<h2 style="text-align:center; padding: 50px;">Error al cargar la demo</h2>`;
    }
});