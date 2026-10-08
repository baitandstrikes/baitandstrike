/* BNS Quick View — Woo "Lihat cepat" port for Trade 16.x.
   Uses /products/<handle>.js (public, no app needed). Add-to-cart via /cart/add.js
   so checkout totals follow Shopify pricing. */
(function () {
  if (window.BNSQuickView) return;
  var BRL = 'id-ID';

  function money(cents) {
    try {
      return (cents / 100).toLocaleString(BRL, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
    } catch (e) {
      return 'Rp ' + (cents / 100).toLocaleString(BRL);
    }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var dialog = document.createElement('dialog');
  dialog.className = 'bns-qv-dialog';
  dialog.setAttribute('aria-labelledby', 'bns-qv-title');
  dialog.innerHTML =
    '<div class="bns-qv-panel"><button class="bns-qv-close" type="button" aria-label="Tutup detail produk">&times;</button>' +
    '<div class="bns-qv-content" aria-live="polite"></div></div>';
  document.body.appendChild(dialog);
  var content = dialog.querySelector('.bns-qv-content');
  var lastTrigger = null;

  function close() { if (dialog.open) dialog.close(); }
  dialog.querySelector('.bns-qv-close').addEventListener('click', close);
  dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); });
  dialog.addEventListener('close', function () { if (lastTrigger) lastTrigger.focus(); });

  function msg(text, isError) {
    content.replaceChildren();
    var p = el('p', 'bns-qv-msg' + (isError ? ' is-error' : ''), text);
    p.setAttribute('role', isError ? 'alert' : 'status');
    content.appendChild(p);
  }

  function thumbImg(src, alt) {
    var img = document.createElement('img');
    img.src = src; img.alt = alt || ''; img.loading = 'lazy';
    return img;
  }

  function render(product, handle) {
    content.replaceChildren();
    var body = el('div', 'bns-qv-body');

    var gallery = el('div', 'bns-qv-gallery');
    var main = el('div', 'bns-qv-main');
    var imgs = (product.images || []).map(function (src) {
      return src.indexOf('http') === 0 ? src : 'https:' + src;
    });
    if (!imgs.length && product.featured_image) {
      imgs = ['https:' + product.featured_image];
    }
    if (imgs.length) main.appendChild(thumbImg(imgs[0], product.title));
    gallery.appendChild(main);
    if (imgs.length > 1) {
      var thumbs = el('div', 'bns-qv-thumbs');
      imgs.forEach(function (src, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'bns-qv-thumb';
        b.setAttribute('aria-label', 'Lihat foto ' + (i + 1));
        b.setAttribute('aria-current', String(i === 0));
        b.appendChild(thumbImg(src, ''));
        b.addEventListener('click', function () {
          main.replaceChildren(thumbImg(src, product.title));
          thumbs.querySelector('[aria-current="true"]').setAttribute('aria-current', 'false');
          b.setAttribute('aria-current', 'true');
        });
        thumbs.appendChild(b);
      });
      gallery.appendChild(thumbs);
    }

    var details = el('div', 'bns-qv-details');
    var title = el('h2', null, product.title);
    title.id = 'bns-qv-title';
    details.appendChild(title);

    var sku = product.variants && product.variants.length === 1 && product.variants[0].sku
      ? product.variants[0].sku : '';
    if (sku) details.appendChild(el('p', 'bns-qv-sku', 'SKU: ' + sku));

    var priceBox = el('div', 'bns-qv-price');
    var firstAvail = (product.variants || []).filter(function (v) { return v.available; })[0]
      || (product.variants || [])[0];
    if (firstAvail) {
      if (firstAvail.compare_at_price && firstAvail.compare_at_price > firstAvail.price) {
        var s = document.createElement('s');
        s.textContent = money(firstAvail.compare_at_price);
        priceBox.appendChild(s);
        priceBox.appendChild(document.createTextNode(' ' + money(firstAvail.price)));
      } else {
        priceBox.textContent = money(firstAvail.price);
      }
    } else {
      priceBox.textContent = money(product.price);
    }
    details.appendChild(priceBox);

    var stock = el('p', 'bns-qv-stock' + (product.available ? '' : ' is-out'),
      product.available ? 'Tersedia' : 'Stok habis');
    details.appendChild(stock);

    if (product.description) {
      var desc = el('div', 'bns-qv-desc');
      var tmp = document.createElement('template');
      tmp.innerHTML = product.description;
      var txt = (tmp.content.textContent || '').trim().slice(0, 600);
      desc.textContent = txt;
      if (txt) details.appendChild(desc);
    }

    var form = null, selectWrap = null, qty = null, addBtn = null;
    var variants = product.variants || [];
    if (variants.length > 1) {
      selectWrap = el('div', 'bns-qv-options');
      (product.options || []).forEach(function (opt) {
        var label = el('label', null, opt.name);
        var sel = document.createElement('select');
        sel.dataset.opt = opt.name;
        opt.values.forEach(function (val) {
          var o = document.createElement('option');
          o.value = val; o.textContent = val;
          sel.appendChild(o);
        });
        label.appendChild(sel);
        selectWrap.appendChild(label);
      });
      details.appendChild(selectWrap);
    }

    form = el('div', 'bns-qv-buy');
    qty = document.createElement('input');
    qty.type = 'number'; qty.min = '1'; qty.value = '1'; qty.setAttribute('aria-label', 'Jumlah');
    addBtn = el('button', 'bns-qv-add', 'Tambah ke keranjang');
    addBtn.type = 'button';
    form.appendChild(qty);
    form.appendChild(addBtn);
    details.appendChild(form);

    var detailLink = el('a', 'bns-qv-detail-link', 'Lihat detail lengkap');
    detailLink.href = '/products/' + handle;
    details.appendChild(detailLink);

    body.appendChild(gallery);
    body.appendChild(details);
    content.appendChild(body);

    function currentVariant() {
      if (variants.length <= 1) return variants[0] || null;
      var chosen = Array.prototype.map.call(
        selectWrap.querySelectorAll('select'), function (s) { return s.value; });
      for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        if ((v.options || []).join('||') === chosen.join('||')) return v;
      }
      return null;
    }

    function refresh() {
      var v = currentVariant();
      if (!v) { addBtn.disabled = true; return; }
      addBtn.disabled = !v.available;
      if (v.sku) {
        var skuEl = details.querySelector('.bns-qv-sku');
        if (!skuEl) { skuEl = el('p', 'bns-qv-sku'); details.insertBefore(skuEl, priceBox); }
        skuEl.textContent = 'SKU: ' + v.sku;
      }
      priceBox.replaceChildren();
      if (v.compare_at_price && v.compare_at_price > v.price) {
        var s = document.createElement('s');
        s.textContent = money(v.compare_at_price);
        priceBox.appendChild(s);
        priceBox.appendChild(document.createTextNode(' ' + money(v.price)));
      } else {
        priceBox.textContent = money(v.price);
      }
      stock.textContent = v.available ? 'Tersedia' : 'Stok habis';
      stock.classList.toggle('is-out', !v.available);
      var min = (v.quantity_rule && v.quantity_rule.min) || 1;
      qty.min = String(min);
      if (parseInt(qty.value || '1', 10) < min) qty.value = String(min);
    }

    if (selectWrap) {
      selectWrap.addEventListener('change', refresh);
      refresh();
    } else if (firstAvail && !firstAvail.available) {
      addBtn.disabled = true;
    }

    addBtn.addEventListener('click', function () {
      var v = currentVariant();
      if (!v || !v.available) { msg('Varian tidak tersedia. Pilih varian lain.', true); render(product, handle); return; }
      var q = Math.max(parseInt(qty.value || '1', 10), parseInt(qty.min || '1', 10));
      addBtn.disabled = true;
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: v.id, quantity: q })
      }).then(function (r) {
        if (!r.ok) throw new Error('add');
        return r.json();
      }).then(function () {
        document.documentElement.dispatchEvent(new CustomEvent('bns:cart-changed', { bubbles: true }));
        var note = el('p', 'bns-qv-msg', 'Produk berhasil ditambahkan ke keranjang.');
        note.setAttribute('role', 'status');
        details.appendChild(note);
        var drawer = document.querySelector('cart-drawer');
        if (drawer && typeof drawer.open === 'function') { drawer.open(); }
        else if (typeof drawer !== 'undefined' && drawer) {
          drawer.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));
        }
      }).catch(function () {
        var err = el('p', 'bns-qv-msg is-error', 'Varian tidak dapat ditambahkan. Periksa ketersediaan dan coba lagi.');
        err.setAttribute('role', 'alert');
        details.appendChild(err);
      }).finally(function () { addBtn.disabled = false; });
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-bns-quick-view]');
    if (!t) return;
    e.preventDefault();
    lastTrigger = t;
    var handle = t.getAttribute('data-bns-quick-view');
    if (!handle) return;
    msg('Memuat detail produk…', false);
    if (!dialog.open) dialog.showModal();
    fetch('/products/' + handle + '.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('load'); return r.json(); })
      .then(function (p) { render(p, handle); })
      .catch(function () { msg('Detail produk belum dapat dimuat. Silakan coba lagi.', true); });
  });

  window.BNSQuickView = { open: function (handle) {
    var f = document.querySelector('[data-bns-quick-view="' + handle + '"]');
    if (f) f.click();
  } };
})();
