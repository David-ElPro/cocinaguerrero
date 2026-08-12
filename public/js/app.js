document.addEventListener("DOMContentLoaded", async () => {
    const CART_KEY = "cocinaGuerreroCart";
    const GOOGLE_MENU_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQMVaeGU8sp81WXnzULp9xNJG74w-sxgLi3sq-I_TBQmT5MrnlpcBQ3KJVW1BWhYQ9XYu2UvowYkBE3/pub?output=csv";
    const CATEGORY_ORDER = [
        "a-la-carta",
        "platos",
        "bebidas",
        "postres",
        "snacks",
        "del-comal",
        "especiales"
    ];
    const cartModal = document.getElementById("cart-modal");
    const cartItemsList = document.getElementById("cart-items-list");
    const cartTotalElement = document.getElementById("cart-total");
    const cartCountElement = document.getElementById("cart-count");
    const cartTotalDisplay = document.getElementById("cart-total-display");
    const sendCartWaBtn = document.getElementById("send-cart-wa");

    const urlParams = new URLSearchParams(window.location.search);
    let clientSlug = urlParams.get("c");

    if (!clientSlug) {
        const segments = window.location.pathname
            .split("/")
            .filter(s => s && s !== "index.html" && s !== "public" && !s.includes("."));
        const last = segments[segments.length - 1];
        clientSlug = (!last || last.toLowerCase() === "cocinaguerrero") ? "cocina-guerrero" : last;
    }

    const formatCurrency = (value) => new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Number(value) || 0);

    const parsePrice = (value) => {
        const parsed = Number(String(value).replace(/[^\d.]/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const normalizePhone = (value) => {
        const digits = String(value || "").replace(/\D/g, "");
        return digits.startsWith("52") ? digits : `52${digits}`;
    };

    const getCart = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
            return Array.isArray(saved) ? saved : [];
        } catch (error) {
            return [];
        }
    };

    const saveCart = (cart) => localStorage.setItem(CART_KEY, JSON.stringify(cart));

    const setCartQuantity = (itemId, nextQty) => {
        const cart = getCart();
        const itemIndex = cart.findIndex((item) => item.id === itemId);

        if (itemIndex === -1 && Number(nextQty) > 0) {
            return;
        }

        if (itemIndex === -1) {
            return;
        }

        const nextValue = Math.max(0, Number(nextQty) || 0);
        if (nextValue <= 0) {
            cart.splice(itemIndex, 1);
        } else {
            cart[itemIndex].cantidad = nextValue;
        }

        saveCart(cart);
        refreshQuantityDisplays();
        renderCartModal();
    };

    const removeItemFromCart = (itemId) => {
        const cart = getCart().filter((item) => item.id !== itemId);
        saveCart(cart);
        refreshQuantityDisplays();
        renderCartModal();
    };

    const parseCsv = (csvText) => {
        const rows = [];
        let current = "";
        let row = [];
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i += 1) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (char === "," && !inQuotes) {
                row.push(current);
                current = "";
                continue;
            }

            if ((char === "\n" || char === "\r") && !inQuotes) {
                if (char === "\r" && nextChar === "\n") {
                    i += 1;
                }
                row.push(current);
                if (row.some((cell) => String(cell).trim() !== "")) {
                    rows.push(row);
                }
                row = [];
                current = "";
                continue;
            }

            current += char;
        }

        if (current.length > 0 || row.length > 0) {
            row.push(current);
            if (row.some((cell) => String(cell).trim() !== "")) {
                rows.push(row);
            }
        }

        if (!rows.length) return [];

        const [headers, ...dataRows] = rows;
        const normalizedHeaders = headers.map((header) => String(header).trim().toLowerCase());

        return dataRows.map((values) => {
            const record = {};
            normalizedHeaders.forEach((header, index) => {
                record[header] = (values[index] !== undefined) ? values[index].trim() : "";
            });
            return record;
        }).filter((item) => item.nombre || item.precio || item.descripcion || item.imagen);
    };

    const normalizeCategory = (value) => {
        const raw = String(value || "").trim().toLowerCase();
        if (!raw) return "a-la-carta";

        const normalized = raw
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        return CATEGORY_ORDER.includes(normalized) ? normalized : "a-la-carta";
    };

    const getCategoryLabel = (category) => {
        const labels = {
            "a-la-carta": "A la carta",
            platos: "Platos",
            bebidas: "Bebidas",
            postres: "Postres",
            snacks: "Snacks",
            "del-comal": "Del comal",
            especiales: "Especiales"
        };

        return labels[category] || category.replace(/-/g, " ");
    };

    const getCategoryIcon = (category) => {
        const icons = {
            "a-la-carta": "fa-solid fa-book-open",
            platos: "fa-solid fa-utensils",
            bebidas: "fa-solid fa-mug-hot",
            postres: "fa-solid fa-ice-cream",
            snacks: "fa-solid fa-cookie-bite",
            "del-comal": "fa-solid fa-fire-burner",
            especiales: "fa-solid fa-star"
        };

        return icons[category] || "fa-solid fa-utensils";
    };

    let productHandlersBound = false;
    let cartHandlersBound = false;

    const renderMenuFromCsv = async () => {
        const catalogContainer = document.getElementById("catalog-container");
        if (!catalogContainer) return;

        try {
            const response = await fetch(GOOGLE_MENU_CSV_URL, { cache: "no-store" });
            if (!response.ok) throw new Error("No se pudo cargar el CSV del menú");

            const csvText = await response.text();
            const records = parseCsv(csvText);
            const validItems = records
                .filter((item) => item.nombre && item.precio)
                .map((item) => ({
                    id: slugify(`${item.categoria || "a-la-carta"}-${item.nombre}`),
                    nombre: item.nombre,
                    precio: Number.parseFloat(String(item.precio).replace(/[$,\s]/g, "")) || 0,
                    descripcion: item.descripcion || "",
                    imagen: item.imagen || "./img/logo.png",
                    categoria: normalizeCategory(item.categoria)
                }));

            if (!validItems.length) {
                catalogContainer.innerHTML = '<div class="empty-cart"><div><i class="fa-solid fa-bowl-food"></i><p>No hay productos disponibles en este momento.</p></div></div>';
                return;
            }

            const groupedItems = validItems.reduce((accumulator, item) => {
                if (!accumulator[item.categoria]) {
                    accumulator[item.categoria] = [];
                }
                accumulator[item.categoria].push(item);
                return accumulator;
            }, {});

            const orderedCategories = [...new Set([...CATEGORY_ORDER.filter((category) => groupedItems[category]), ...Object.keys(groupedItems).filter((category) => !CATEGORY_ORDER.includes(category))])];

            catalogContainer.innerHTML = orderedCategories.map((category) => `
                <section class="menu-category-section">
                    <div class="category-header">
                        <h3 class="category-title"><i class="${getCategoryIcon(category)}"></i> ${getCategoryLabel(category)}</h3>
                    </div>
                    <div class="cards-grid">
                        ${groupedItems[category].map((item) => `
                            <div class="food-card">
                                <div>
                                    <div class="card-img-wrapper">
                                        <img src="${item.imagen}" alt="${item.nombre}" loading="lazy">
                                    </div>
                                    <div class="card-body">
                                        <h4 class="card-title">${item.nombre}</h4>
                                        <p class="card-desc">${item.descripcion}</p>
                                    </div>
                                </div>
                                <div class="card-body" style="padding-top:0;">
                                    <div class="card-footer">
                                        <span class="card-price">$${item.precio.toFixed(2).replace(/\.00$/, "")}</span>
                                        <div class="qty-control" data-item-id="${item.id}">
                                            <button class="qty-btn" type="button" data-action="decrease" data-item-id="${item.id}" data-item-name="${item.nombre}" data-item-price="${item.precio}" data-item-img="${item.imagen}" aria-label="Restar ${item.nombre}">−</button>
                                            <input class="qty-input" type="number" min="0" step="1" value="0" data-item-id="${item.id}" data-item-name="${item.nombre}" data-item-price="${item.precio}" data-item-img="${item.imagen}" aria-label="Cantidad de ${item.nombre}">
                                            <button class="qty-btn" type="button" data-action="increase" data-item-id="${item.id}" data-item-name="${item.nombre}" data-item-price="${item.precio}" data-item-img="${item.imagen}" aria-label="Sumar ${item.nombre}">+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </section>
            `).join("");

            bindProductButtons();
            bindCartButtons();
            refreshQuantityDisplays();
        } catch (error) {
            console.error("Error cargando menú desde CSV:", error);
            catalogContainer.innerHTML = '<div class="empty-cart"><div><i class="fa-solid fa-circle-exclamation"></i><p>No se pudo cargar el menú.</p></div></div>';
        }
    };

    const slugify = (value) => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "item";

    const openCart = () => {
        if (!cartModal) return;
        cartModal.classList.add("is-open");
        cartModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    };

    const closeCart = () => {
        if (!cartModal) return;
        cartModal.classList.remove("is-open");
        cartModal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    };

    const refreshQuantityDisplays = () => {
        const cart = getCart();
        const cartMap = new Map(cart.map((item) => [item.id, item]));

        document.querySelectorAll(".qty-control").forEach((control) => {
            const productId = control.dataset.itemId;
            const currentQty = cartMap.get(productId)?.cantidad || 0;
            const qtyInput = control.querySelector(".qty-input");

            if (qtyInput) {
                qtyInput.value = String(currentQty);
            }

            control.classList.toggle("filled", currentQty > 0);
        });
    };

    const syncCartTotals = () => {
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
        const totalPrice = cart.reduce((sum, item) => sum + (Number(item.precio || 0) * Number(item.cantidad || 0)), 0);

        cartCountElement.textContent = String(totalItems);
        cartTotalDisplay.textContent = formatCurrency(totalPrice);
        cartTotalElement.textContent = formatCurrency(totalPrice);
        sendCartWaBtn.disabled = totalItems === 0;
    };

    const updateItemInCart = (itemMeta, delta) => {
        const cart = getCart();
        const itemIndex = cart.findIndex((item) => item.id === itemMeta.id);

        if (itemIndex >= 0) {
            const nextQty = Number(cart[itemIndex].cantidad || 0) + delta;
            if (nextQty <= 0) {
                cart.splice(itemIndex, 1);
            } else {
                cart[itemIndex].cantidad = nextQty;
            }
        } else if (delta > 0) {
            cart.push({
                id: itemMeta.id,
                nombre: itemMeta.nombre,
                precio: itemMeta.precio,
                cantidad: 1,
                imagen: itemMeta.imagen || itemMeta.img || ""
            });
        }

        saveCart(cart);
        refreshQuantityDisplays();
        renderCartModal();
    };

    const setItemQuantityDirect = (itemMeta, nextQty) => {
        const cart = getCart();
        const itemIndex = cart.findIndex((item) => item.id === itemMeta.id);
        const safeQty = Math.max(0, Number(nextQty) || 0);

        if (itemIndex >= 0) {
            if (safeQty <= 0) {
                cart.splice(itemIndex, 1);
            } else {
                cart[itemIndex].cantidad = safeQty;
            }
        } else if (safeQty > 0) {
            cart.push({
                id: itemMeta.id,
                nombre: itemMeta.nombre,
                precio: itemMeta.precio,
                cantidad: safeQty,
                imagen: itemMeta.imagen || itemMeta.img || ""
            });
        }

        saveCart(cart);
        refreshQuantityDisplays();
        renderCartModal();
    };

    const bindProductButtons = () => {
        if (productHandlersBound) return;
        productHandlersBound = true;

        document.addEventListener("click", (event) => {
            const button = event.target.closest(".qty-btn");
            if (!button) return;

            const productId = button.dataset.itemId;
            const itemName = button.dataset.itemName;
            const itemPrice = Number(button.dataset.itemPrice || 0);
            const itemImg = button.dataset.itemImg || "";
            const delta = button.dataset.action === "increase" ? 1 : -1;
            updateItemInCart({ id: productId, nombre: itemName, precio: itemPrice, imagen: itemImg }, delta);
        });

        document.addEventListener("change", (event) => {
            const input = event.target.closest(".qty-input");
            if (!input) return;

            const productId = input.dataset.itemId;
            const itemInCart = getCart().find((item) => item.id === productId);
            const nextQty = Math.max(0, Number(input.value) || 0);

            if (itemInCart || nextQty > 0) {
                const itemMeta = {
                    id: productId,
                    nombre: input.dataset.itemName || itemInCart?.nombre || "Producto",
                    precio: Number(input.dataset.itemPrice || itemInCart?.precio || 0),
                    imagen: input.dataset.itemImg || itemInCart?.imagen || ""
                };
                setItemQuantityDirect(itemMeta, nextQty);
            }
        });
    };

    const bindCartButtons = () => {
        if (cartHandlersBound) return;
        cartHandlersBound = true;

        document.addEventListener("click", (event) => {
            const button = event.target.closest(".mini-qty-btn");
            if (!button) return;

            const productId = button.dataset.itemId;
            const cartItem = getCart().find((item) => item.id === productId);
            if (!cartItem) return;

            const delta = button.dataset.action === "increase" ? 1 : -1;
            updateItemInCart({ id: cartItem.id, nombre: cartItem.nombre, precio: cartItem.precio, imagen: cartItem.imagen }, delta);
        });

        document.addEventListener("click", (event) => {
            const button = event.target.closest(".cart-remove-btn");
            if (!button) return;
            removeItemFromCart(button.dataset.itemId);
        });

        document.addEventListener("change", (event) => {
            const input = event.target.closest(".cart-qty-input");
            if (!input) return;

            const cartItem = getCart().find((item) => item.id === input.dataset.itemId);
            if (!cartItem) return;

            setItemQuantityDirect({
                id: cartItem.id,
                nombre: cartItem.nombre,
                precio: cartItem.precio,
                imagen: cartItem.imagen
            }, Number(input.value) || 0);
        });
    };

    const renderCartModal = () => {
        const cart = getCart();

        if (!cart.length) {
            cartItemsList.innerHTML = `
                <div class="empty-cart">
                    <div>
                        <i class="fa-solid fa-bag-shopping"></i>
                        <p>Tu carrito está vacío.</p>
                    </div>
                </div>
            `;
            syncCartTotals();
            return;
        }

        cartItemsList.innerHTML = cart.map((item) => `
            <div class="cart-item-row">
                <div class="cart-item-thumb"><img src="${item.imagen || './img/logo.png'}" alt="${item.nombre}" loading="lazy"></div>
                <div class="cart-item-info">
                    <span class="cart-item-name">${item.nombre}</span>
                    <span class="cart-item-price">${formatCurrency(item.precio)} c/u</span>
                </div>
                <div class="cart-item-controls">
                    <button class="mini-qty-btn" type="button" data-action="decrease" data-item-id="${item.id}" aria-label="Restar ${item.nombre}">−</button>
                    <input class="cart-qty-input" type="number" min="0" step="1" value="${item.cantidad}" data-item-id="${item.id}" aria-label="Cantidad de ${item.nombre}">
                    <button class="mini-qty-btn" type="button" data-action="increase" data-item-id="${item.id}" aria-label="Sumar ${item.nombre}">+</button>
                </div>
                <div class="cart-item-actions">
                    <strong>${formatCurrency(item.precio * item.cantidad)}</strong>
                    <button class="cart-remove-btn" type="button" data-item-id="${item.id}" aria-label="Eliminar ${item.nombre}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join("");

        syncCartTotals();
    };

    const buildWhatsAppOrder = (waNumber, cart) => {
        if (!cart.length) return "";

        const lines = [
            "Hola Cocina Guerrero 👋",
            "Quiero hacer este pedido:",
            ...cart.map((item) => `- ${item.nombre} x${item.cantidad} = ${formatCurrency(item.precio * item.cantidad)}`),
            "",
            `Total: ${formatCurrency(cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0))}`,
            "",
            "Gracias."
        ];

        return `https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
    };

    try {
        const response = await fetch(`./data/${clientSlug}.json`);
        if (!response.ok) throw new Error("Cliente no encontrado");

        const data = await response.json();

        const setSeoMeta = (restaurantData) => {
            const restaurantName = restaurantData.nombre || "Cocina Guerrero";
            const description = restaurantData.eslogan || "Menú digital con pedidos por WhatsApp.";
            const siteUrl = window.location.href.split("#")[0];
            const phone = normalizePhone(restaurantData.whatsapp || "521234567890");

            const metaMap = {
                "description": description,
                "og:title": `${restaurantName} | Menú Digital`,
                "og:description": description,
                "og:url": siteUrl,
                "og:site_name": restaurantName,
                "twitter:title": `${restaurantName} | Menú Digital`,
                "twitter:description": description
            };

            Object.entries(metaMap).forEach(([key, value]) => {
                const selector = key.startsWith("og:") ? `meta[property="${key}"]` : `meta[name="${key}"]`;
                let meta = document.querySelector(selector);

                if (!meta) {
                    meta = document.createElement("meta");
                    if (key.startsWith("og:")) {
                        meta.setAttribute("property", key);
                    } else {
                        meta.setAttribute("name", key);
                    }
                    document.head.appendChild(meta);
                }

                meta.setAttribute("content", value);
            });

            const schemaScript = document.getElementById("restaurant-schema") || document.createElement("script");
            schemaScript.id = "restaurant-schema";
            schemaScript.type = "application/ld+json";
            schemaScript.textContent = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Restaurant",
                "name": restaurantName,
                "image": restaurantData.logo || "img/logo.png",
                "description": description,
                "servesCuisine": "Mexican",
                "telephone": `+${phone}`,
                "url": siteUrl,
                "menu": `${siteUrl}#menu-section`,
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": restaurantData.direccion || "Morelos",
                    "addressLocality": restaurantData.ciudad || "Jiutepec",
                    "addressRegion": restaurantData.estado || "Morelos",
                    "addressCountry": "MX"
                }
            });
            document.head.appendChild(schemaScript);
        };

        setSeoMeta(data);

        document.title = `${data.nombre} | Menú Digital`;
        document.getElementById("client-logo").src = data.logo;
        document.getElementById("client-title").textContent = data.nombre;
        document.getElementById("hero-title").textContent = data.nombre;
        document.getElementById("client-subtitle").textContent = data.eslogan;
        document.getElementById("footer-slogan").textContent = data.eslogan;
        document.getElementById("client-schedule").innerHTML = `<i class="fa-solid fa-clock"></i> ${data.horario}`;
        document.getElementById("footer-address").innerHTML = `<i class="fa-solid fa-location-dot"></i> ${data.direccion}`;

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

        const waPhone = normalizePhone(data.whatsapp);
        const msgGeneral = encodeURIComponent("¡Hola Cocina Guerrero! Me gustaría hacer un pedido.");
        const msgGuisados = encodeURIComponent("¡Hola! Quisiera consultar los guisados del día de hoy.");

        document.getElementById("btn-hero-wa").href = `https://wa.me/${waPhone}?text=${msgGeneral}`;
        document.getElementById("btn-daily-wa").href = `https://wa.me/${waPhone}?text=${msgGuisados}`;
        document.getElementById("btn-wa-float").href = `https://wa.me/${waPhone}?text=${msgGeneral}`;

        if (data.carousel && data.carousel.length > 0) {
            const carouselBg = document.getElementById("carousel-bg");
            let idx = 0;
            carouselBg.style.backgroundImage = `url('${data.carousel[0]}')`;
            setInterval(() => {
                idx = (idx + 1) % data.carousel.length;
                carouselBg.style.backgroundImage = `url('${data.carousel[idx]}')`;
            }, 4000);
        }

        await renderMenuFromCsv();

        document.getElementById("open-cart-btn").addEventListener("click", () => {
            renderCartModal();
            openCart();
        });

        document.getElementById("close-cart-btn").addEventListener("click", () => {
            closeCart();
        });

        cartModal.addEventListener("click", (event) => {
            if (event.target === cartModal) {
                closeCart();
            }
        });

        sendCartWaBtn.addEventListener("click", () => {
            const cart = getCart();
            const orderUrl = buildWhatsAppOrder(waPhone, cart);
            if (orderUrl) {
                window.open(orderUrl, "_blank");
            }
        });

        refreshQuantityDisplays();
        renderCartModal();

        const testimonialsData = [
            { nombre: "Karla M.", texto: "La milanesa y el agua del día están riquísimas. El servicio por WhatsApp es super rápido.", imagen: "./img/test1.webp" },
            { nombre: "María Fernanda G.", texto: "El pozole de los jueves es una joya. Sabor súper casero y las porciones muy bien servidas.", imagen: "./img/test2.jpg" },
            { nombre: "Roberta H.", texto: "Excelente opción para comer rico y a buen precio todos los días en la oficina.", imagen: "./img/test3.jpg" },
            { nombre: "Andrea P.", texto: "Las cecina y las enchiladas verdes están excelentes. Se nota la higiene y frescura.", imagen: "./img/test4.jpg" },
            { nombre: "Luisa.", texto: "Las gorditas de chales con pollo encima son adictivas. Súper recomendado.", imagen: "./img/test5.jpg" },
            { nombre: "Lucía B.", texto: "Gran sazón, el envío por WhatsApp me ahorra muchísimo tiempo a la hora de comer.", imagen: "./img/test6.jpg" }
        ];

        const testiTrack = document.getElementById("testi-track");
        testiTrack.innerHTML = testimonialsData.map((t) => `
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
        `).join("");

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

        setInterval(() => {
            currentTesti = (currentTesti + 1) % testimonialsData.length;
            updateTestiSlide();
        }, 5000);

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

        document.querySelectorAll(".nav-link").forEach((link) => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("active");
                navToggle.classList.remove("active");
            });
        });

        setTimeout(() => {
            const tooltip = document.getElementById("wa-tooltip");
            if (tooltip) {
                tooltip.style.transition = "opacity 0.5s ease";
                tooltip.style.opacity = "0";
                setTimeout(() => tooltip.remove(), 500);
            }
        }, 5000);

        const socialToggleBtn = document.getElementById("social-toggle-btn");
        const socialContainer = document.getElementById("social-floatings-container");
        let socialOpen = false;

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

        document.addEventListener("click", (e) => {
            if (socialOpen && !socialContainer.contains(e.target) && !socialToggleBtn.contains(e.target)) {
                socialOpen = false;
                socialContainer.classList.remove("open");
                socialToggleBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';
            }
        });

        document.getElementById("app").style.display = "block";

    } catch (err) {
        console.error(err);
        document.body.innerHTML = `<h2 style="text-align:center; padding: 50px;">Error al cargar la demo</h2>`;
    }
});