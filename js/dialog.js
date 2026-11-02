const ui = (() => {
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let uid = 0;
  let chain = Promise.resolve();

  function node(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function present(message, opts, isConfirm) {
    const run = () => new Promise((resolve) => {
      const id = ++uid;
      const returnTo = document.activeElement;
      const dlg = node('dialog', 'ui-dialog');
      dlg.setAttribute('role', 'alertdialog');
      dlg.setAttribute('aria-modal', 'true');
      dlg.setAttribute('aria-labelledby', `ui-dialog-title-${id}`);
      dlg.setAttribute('aria-describedby', `ui-dialog-msg-${id}`);

      const panel = node('div', 'ui-dialog-panel');
      const title = node('h2', 'ui-dialog-title', opts.title || (isConfirm ? 'Please confirm' : 'Notice'));
      title.id = `ui-dialog-title-${id}`;
      const msg = node('p', 'ui-dialog-msg', message == null ? '' : String(message));
      msg.id = `ui-dialog-msg-${id}`;
      const actions = node('div', 'ui-dialog-actions');

      let cancelBtn = null;
      if (isConfirm) {
        cancelBtn = node('button', 'btn btn-secondary', opts.cancelLabel || 'Cancel');
        cancelBtn.type = 'button';
        cancelBtn.addEventListener('click', () => dlg.close('cancel'));
        actions.appendChild(cancelBtn);
      }
      const okBtn = node('button', `btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`, isConfirm ? (opts.confirmLabel || 'Confirm') : (opts.confirmLabel || 'OK'));
      okBtn.type = 'button';
      okBtn.addEventListener('click', () => dlg.close('ok'));
      actions.appendChild(okBtn);

      panel.append(title, msg, actions);
      dlg.appendChild(panel);

      dlg.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key !== 'Tab') return;
        const items = Array.from(dlg.querySelectorAll(FOCUSABLE));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dlg.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !dlg.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      });

      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) dlg.close('cancel');
      });

      dlg.addEventListener('close', () => {
        const ok = dlg.returnValue === 'ok';
        dlg.remove();
        if (returnTo && returnTo.focus && document.contains(returnTo)) returnTo.focus({ preventScroll: true });
        resolve(isConfirm ? ok : undefined);
      });

      document.body.appendChild(dlg);
      dlg.showModal();
      const safe = isConfirm && opts.danger ? cancelBtn : okBtn;
      safe.focus();
    });
    const result = chain.then(run);
    chain = result.catch(() => {});
    return result;
  }

  function alertDialog(message, opts) {
    return present(message, opts || {}, false);
  }

  function confirmDialog(message, opts) {
    return present(message, opts || {}, true);
  }

  let polite = null;
  let assertive = null;

  function regions() {
    if (polite) return;
    polite = node('div', 'toast-region');
    polite.setAttribute('role', 'status');
    polite.setAttribute('aria-live', 'polite');
    assertive = node('div', 'toast-region toast-region-alert');
    assertive.setAttribute('role', 'alert');
    assertive.setAttribute('aria-live', 'assertive');
    document.body.append(polite, assertive);
  }

  function toast(message, opts) {
    regions();
    const kind = (opts && opts.kind) || 'info';
    const isError = kind === 'error';
    const host = isError ? assertive : polite;
    const t = node('div', `toast toast-${kind}`);
    const text = node('span', 'toast-text', message == null ? '' : String(message));
    const close = node('button', 'toast-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss notification');
    t.append(text, close);

    let timer = 0;
    function dismiss() {
      clearTimeout(timer);
      t.remove();
    }
    function arm() {
      clearTimeout(timer);
      timer = setTimeout(dismiss, isError ? 8000 : 4000);
    }
    close.addEventListener('click', dismiss);
    t.addEventListener('pointerenter', () => clearTimeout(timer));
    t.addEventListener('pointerleave', arm);
    t.addEventListener('focusin', () => clearTimeout(timer));
    t.addEventListener('focusout', arm);
    host.appendChild(t);
    arm();
  }

  return { alert: alertDialog, confirm: confirmDialog, toast };
})();
