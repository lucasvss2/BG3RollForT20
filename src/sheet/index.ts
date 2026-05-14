import { log } from "@/utils/logging";

const SHEET_STYLES_ID = "t20-sheet-redesign-styles";

// ── CSS overrides ─────────────────────────────────────────────────────────────

const SHEET_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');

/* ── Sheet Root ──────────────────────────────────────────────────────────── */
form.tormenta20.tabbed {
    background: #0c0907 !important;
    color: #d4c4a0 !important;
    font-family: 'EB Garamond', 'Palatino Linotype', serif !important;
}

/* ── Sheet Header ────────────────────────────────────────────────────────── */
form.tormenta20.tabbed .sheet-header {
    background: linear-gradient(to bottom, #1a1108 0%, #0c0907 100%) !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.4) !important;
    padding: 10px 12px !important;
    gap: 12px !important;
    align-items: flex-start !important;
}

form.tormenta20.tabbed .sheet-header .profile {
    border: 2px solid rgba(201, 167, 106, 0.5) !important;
    border-radius: 3px !important;
    box-shadow: 0 0 0 1px #2a1e08, 0 4px 14px rgba(0,0,0,0.7) !important;
    flex-shrink: 0 !important;
    object-fit: cover !important;
}

form.tormenta20.tabbed .sheet-header .header-details {
    gap: 4px !important;
    flex: 1 !important;
}

form.tormenta20.tabbed .sheet-header .general-information {
    gap: 8px !important;
    align-items: flex-start !important;
}

form.tormenta20.tabbed .sheet-header .charname {
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
    flex: 1 !important;
}
form.tormenta20.tabbed .sheet-header .charname input {
    background: transparent !important;
    border: none !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.3) !important;
    color: #e6c987 !important;
    font-family: 'Cinzel', 'Modesto Condensed', 'Palatino Linotype', serif !important;
    font-size: 1.3rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.05em !important;
    padding: 2px 0 !important;
    text-shadow: 0 0 12px rgba(230, 201, 135, 0.2) !important;
    width: 100% !important;
    height: auto !important;
}

form.tormenta20.tabbed .sheet-header .header-exp {
    gap: 3px !important;
    align-items: flex-end !important;
}
form.tormenta20.tabbed .sheet-header .charlevel {
    gap: 6px !important;
    align-items: center !important;
}
form.tormenta20.tabbed .sheet-header .level {
    background: rgba(201, 167, 106, 0.1) !important;
    border: 1px solid rgba(201, 167, 106, 0.35) !important;
    border-radius: 3px !important;
    color: #c9a76a !important;
    font-family: 'Cinzel', 'Modesto Condensed', serif !important;
    font-size: 0.68rem !important;
    letter-spacing: 0.1em !important;
    padding: 1px 6px !important;
    white-space: nowrap !important;
}
form.tormenta20.tabbed .sheet-header .config-button {
    color: #5a5040 !important;
}
form.tormenta20.tabbed .sheet-header .config-button:hover {
    color: #c9a76a !important;
}
form.tormenta20.tabbed .sheet-header .experience input,
form.tormenta20.tabbed .sheet-header .experience .sep,
form.tormenta20.tabbed .sheet-header .experience .max-xp {
    color: #6a5e48 !important;
    font-size: 0.7rem !important;
    background: transparent !important;
    border-color: rgba(201, 167, 106, 0.15) !important;
}
form.tormenta20.tabbed .sheet-header .xpbar {
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(201, 167, 106, 0.15) !important;
    border-radius: 2px !important;
    height: 4px !important;
    overflow: hidden !important;
}
form.tormenta20.tabbed .sheet-header .xpbar .bar {
    background: linear-gradient(90deg, #6a4a18, #c9a76a) !important;
    height: 100% !important;
}

/* ── Summary (race, origin, class, deity) ────────────────────────────────── */
form.tormenta20.tabbed ul.attributes.summary {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 2px 6px !important;
    margin: 3px 0 !important;
    padding: 0 !important;
    list-style: none !important;
    align-items: center !important;
}
form.tormenta20.tabbed ul.attributes.summary > li {
    color: #8a7e6a !important;
    font-size: 0.78rem !important;
    font-style: italic !important;
    border: none !important;
    padding: 0 !important;
}
form.tormenta20.tabbed ul.attributes.summary a {
    color: #a89878 !important;
    text-decoration: none !important;
}
form.tormenta20.tabbed ul.attributes.summary a:hover {
    color: #c9a76a !important;
}
form.tormenta20.tabbed ul.attributes.summary input[type="text"] {
    background: transparent !important;
    border: none !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.15) !important;
    color: #8a7e6a !important;
    font-style: italic !important;
    font-size: 0.78rem !important;
    padding: 0 2px !important;
    height: auto !important;
    min-width: 60px !important;
}

/* ── Resource attributes (HP, PM, DEF) ───────────────────────────────────── */
form.tormenta20.tabbed ul.attributes:not(.summary) {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
    padding: 6px 0 4px !important;
    margin: 0 !important;
    list-style: none !important;
}
form.tormenta20.tabbed ul.attributes:not(.summary) .attribute {
    background: rgba(15, 10, 4, 0.8) !important;
    border: 1px solid rgba(201, 167, 106, 0.28) !important;
    border-radius: 4px !important;
    padding: 4px 8px !important;
    min-width: 76px !important;
    flex: 1 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 2px !important;
}
form.tormenta20.tabbed ul.attributes:not(.summary) .attribute-name.box-title {
    color: #6a5e48 !important;
    font-family: 'Cinzel', 'Modesto Condensed', serif !important;
    font-size: 0.58rem !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    margin: 0 0 2px !important;
    border: none !important;
    padding: 0 !important;
    background: none !important;
}
form.tormenta20.tabbed ul.attributes:not(.summary) .attribute-value {
    display: flex !important;
    align-items: center !important;
    gap: 3px !important;
}
form.tormenta20.tabbed ul.attributes:not(.summary) input[type="number"] {
    background: transparent !important;
    border: none !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.18) !important;
    color: #e0d8c8 !important;
    font-size: 0.9rem !important;
    font-weight: 700 !important;
    text-align: center !important;
    width: 34px !important;
    padding: 0 1px !important;
    height: auto !important;
}
form.tormenta20.tabbed ul.attributes:not(.summary) .sep {
    color: #3a3020 !important;
    font-size: 0.75rem !important;
}
form.tormenta20.tabbed ul.attributes:not(.summary) .attribute-footer {
    border-top: 1px solid rgba(201, 167, 106, 0.1) !important;
    margin-top: 2px !important;
    padding-top: 2px !important;
}
form.tormenta20.tabbed ul.attributes:not(.summary) .attribute-footer input {
    width: 100% !important;
    font-size: 0.72rem !important;
    color: #6a5e48 !important;
}
form.tormenta20.tabbed ul.attributes:not(.summary) .attribute.defense .attribute-value {
    color: #c9a76a !important;
    font-size: 1.15rem !important;
    font-weight: 700 !important;
    justify-content: center !important;
}
form.tormenta20.tabbed ul.attributes:not(.summary) .attribute.defense select {
    font-size: 0.68rem !important;
    padding: 0 2px !important;
}

/* ── Vital bars (injected by JS) ─────────────────────────────────────────── */
.t20-vital-bar {
    width: 100% !important;
    height: 4px !important;
    background: rgba(255,255,255,0.05) !important;
    border-radius: 2px !important;
    overflow: hidden !important;
    margin-top: 3px !important;
    flex-shrink: 0 !important;
}
.t20-vital-bar--hp .t20-vital-bar__fill {
    height: 100% !important;
    background: linear-gradient(90deg, #6e2922, #b34a3c) !important;
    border-radius: 2px !important;
    transition: width 0.4s ease !important;
}
.t20-vital-bar--pm .t20-vital-bar__fill {
    height: 100% !important;
    background: linear-gradient(90deg, #3d2c6b, #7a5fb3) !important;
    border-radius: 2px !important;
    transition: width 0.4s ease !important;
}

/* ── Tab Navigation ──────────────────────────────────────────────────────── */
form.tormenta20.tabbed nav.sheet-tabs.tabs {
    background: rgba(8, 5, 1, 0.9) !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.3) !important;
    border-top: 1px solid rgba(201, 167, 106, 0.12) !important;
    padding: 0 4px !important;
    gap: 0 !important;
    flex-shrink: 0 !important;
}
form.tormenta20.tabbed nav.sheet-tabs .item {
    background: transparent !important;
    border: none !important;
    border-bottom: 2px solid transparent !important;
    border-radius: 0 !important;
    color: #4a4030 !important;
    font-family: 'Cinzel', 'Modesto Condensed', serif !important;
    font-size: 0.62rem !important;
    letter-spacing: 0.1em !important;
    padding: 6px 9px !important;
    text-transform: uppercase !important;
    transition: color 0.2s, border-color 0.2s !important;
    margin-bottom: -1px !important;
}
form.tormenta20.tabbed nav.sheet-tabs .item:hover {
    color: #9a8870 !important;
    border-bottom-color: rgba(201, 167, 106, 0.3) !important;
    background: transparent !important;
}
form.tormenta20.tabbed nav.sheet-tabs .item.active {
    color: #c9a76a !important;
    border-bottom-color: #c9a76a !important;
    background: transparent !important;
}
form.tormenta20.tabbed nav.sheet-tabs .item i {
    margin-right: 3px !important;
    font-size: 0.7em !important;
    opacity: 0.8 !important;
}

/* ── Sheet Body ──────────────────────────────────────────────────────────── */
form.tormenta20.tabbed .sheet-body {
    background: #0c0907 !important;
    padding: 8px !important;
    flex: 1 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
}

/* ── Ability Scores ──────────────────────────────────────────────────────── */
form.tormenta20.tabbed .ability-scores {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 5px !important;
    list-style: none !important;
    padding: 0 !important;
    margin: 0 0 10px !important;
}
form.tormenta20.tabbed .ability-scores .ability {
    background: radial-gradient(ellipse at top, #1a1108 0%, #0d0a05 100%) !important;
    border: 1px solid rgba(201, 167, 106, 0.28) !important;
    border-radius: 4px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    padding: 5px 4px !important;
    min-width: 56px !important;
    flex: 1 !important;
    gap: 1px !important;
    box-shadow: inset 0 1px 0 rgba(201, 167, 106, 0.06) !important;
}
form.tormenta20.tabbed .ability-scores .ability-name.box-title {
    color: #6a5e48 !important;
    font-family: 'Cinzel', 'Modesto Condensed', serif !important;
    font-size: 0.58rem !important;
    letter-spacing: 0.14em !important;
    text-transform: uppercase !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    background: none !important;
    cursor: default !important;
}
form.tormenta20.tabbed .ability-scores .ability-name.rollable {
    cursor: pointer !important;
}
form.tormenta20.tabbed .ability-scores .ability-name.rollable:hover {
    color: #c9a76a !important;
}
form.tormenta20.tabbed .ability-scores .atributo-value {
    color: #e6c987 !important;
    font-family: 'Cinzel', 'Modesto Condensed', serif !important;
    font-size: 1.35rem !important;
    font-weight: 700 !important;
    line-height: 1 !important;
    cursor: pointer !important;
}
form.tormenta20.tabbed .ability-scores .rollable:hover .atributo-value {
    color: #c9a76a !important;
    text-shadow: 0 0 8px rgba(201, 167, 106, 0.4) !important;
}
form.tormenta20.tabbed .ability-scores .attribute-footer {
    display: flex !important;
    gap: 2px !important;
    border-top: 1px solid rgba(201, 167, 106, 0.12) !important;
    padding-top: 3px !important;
    margin-top: 2px !important;
    width: 100% !important;
    justify-content: center !important;
}
form.tormenta20.tabbed .ability-scores .attribute-footer input {
    background: transparent !important;
    border: none !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.12) !important;
    color: #5a5040 !important;
    font-size: 0.65rem !important;
    text-align: center !important;
    width: 24px !important;
    padding: 0 !important;
    height: auto !important;
}

/* ── Skills List ─────────────────────────────────────────────────────────── */
form.tormenta20.tabbed .skills-list {
    list-style: none !important;
    padding: 0 !important;
    margin: 0 !important;
}
form.tormenta20.tabbed .skills-list .skill.item-header {
    background: linear-gradient(to right, rgba(201, 167, 106, 0.14), transparent) !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.28) !important;
    border-top: 1px solid rgba(201, 167, 106, 0.12) !important;
    color: #c9a76a !important;
    font-family: 'Cinzel', 'Modesto Condensed', serif !important;
    font-size: 0.68rem !important;
    letter-spacing: 0.1em !important;
    padding: 4px 8px !important;
    text-transform: uppercase !important;
}
form.tormenta20.tabbed .skills-list .skill.item-header a {
    color: #6a5e48 !important;
}
form.tormenta20.tabbed .skills-list .skill.item-header a:hover {
    color: #c9a76a !important;
}
form.tormenta20.tabbed .skills-list .skill {
    border-bottom: 1px solid rgba(201, 167, 106, 0.07) !important;
    padding: 2px 8px !important;
    align-items: center !important;
}
form.tormenta20.tabbed .skills-list .skill:not(.item-header):hover {
    background: rgba(201, 167, 106, 0.05) !important;
}
form.tormenta20.tabbed .skills-list .item-image {
    color: #3a3020 !important;
    width: 18px !important;
    flex-shrink: 0 !important;
    text-align: center !important;
}
form.tormenta20.tabbed .skills-list .item-name {
    color: #b8ad9a !important;
    font-size: 0.8rem !important;
}
form.tormenta20.tabbed .skills-list .item-name .rollable:hover {
    color: #c9a76a !important;
    cursor: pointer !important;
}
form.tormenta20.tabbed .skills-list .item-abl {
    color: #6a5e48 !important;
    font-size: 0.7rem !important;
    text-align: center !important;
}
form.tormenta20.tabbed .skills-list .item-total span {
    color: #d8d0c0 !important;
    font-size: 0.82rem !important;
    font-weight: 700 !important;
}
form.tormenta20.tabbed .skills-list .item-outros input {
    background: transparent !important;
    border: 1px solid rgba(201, 167, 106, 0.2) !important;
    border-radius: 2px !important;
    color: #b8ad9a !important;
    font-size: 0.75rem !important;
    text-align: center !important;
    width: 32px !important;
    padding: 0 2px !important;
}
form.tormenta20.tabbed .skills-list select.selectatr {
    background: rgba(12, 9, 7, 0.8) !important;
    border: 1px solid rgba(201, 167, 106, 0.2) !important;
    color: #8a7e6a !important;
    font-size: 0.7rem !important;
    border-radius: 2px !important;
    padding: 0 2px !important;
    height: auto !important;
}

/* ── Traits / right column ───────────────────────────────────────────────── */
form.tormenta20.tabbed .traits h3 {
    color: #c9a76a !important;
    font-family: 'Cinzel', 'Modesto Condensed', serif !important;
    font-size: 0.72rem !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.25) !important;
    padding-bottom: 3px !important;
    margin: 6px 0 4px !important;
}
form.tormenta20.tabbed .traits label,
form.tormenta20.tabbed .traits a > label {
    color: #7a6e5a !important;
    font-size: 0.74rem !important;
    cursor: pointer !important;
}
form.tormenta20.tabbed .traits label:hover,
form.tormenta20.tabbed .traits a:hover > label {
    color: #c9a76a !important;
}
form.tormenta20.tabbed .traits .trait-list {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 3px !important;
    list-style: none !important;
    padding: 0 !important;
    margin: 2px 0 6px !important;
}
form.tormenta20.tabbed .traits .tag,
form.tormenta20.tabbed .traits .speedtag {
    background: rgba(201, 167, 106, 0.1) !important;
    border: 1px solid rgba(201, 167, 106, 0.25) !important;
    border-radius: 3px !important;
    color: #9a8e7a !important;
    font-size: 0.7rem !important;
    padding: 1px 6px !important;
}
form.tormenta20.tabbed .traits select.actor-size {
    background: rgba(12, 9, 7, 0.8) !important;
    border: 1px solid rgba(201, 167, 106, 0.2) !important;
    border-radius: 2px !important;
    color: #9a8e7a !important;
    font-size: 0.74rem !important;
}
form.tormenta20.tabbed .traits textarea {
    background: rgba(8, 5, 1, 0.7) !important;
    border: 1px solid rgba(201, 167, 106, 0.2) !important;
    border-radius: 3px !important;
    color: #b8ad9a !important;
    font-family: 'EB Garamond', 'Palatino Linotype', serif !important;
    font-size: 0.8rem !important;
    resize: vertical !important;
    line-height: 1.5 !important;
    padding: 4px 6px !important;
}

/* ── Item Lists (inventory, powers, spells, effects) ─────────────────────── */
form.tormenta20.tabbed .item-list,
form.tormenta20.tabbed ol.item-list {
    list-style: none !important;
    padding: 0 !important;
    margin: 0 0 8px !important;
}
form.tormenta20.tabbed .item-list .item-header,
form.tormenta20.tabbed ol.item-list .item-header {
    background: linear-gradient(to right, rgba(201, 167, 106, 0.14), transparent) !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.28) !important;
    border-top: 1px solid rgba(201, 167, 106, 0.1) !important;
    color: #c9a76a !important;
    font-family: 'Cinzel', 'Modesto Condensed', serif !important;
    font-size: 0.65rem !important;
    letter-spacing: 0.1em !important;
    padding: 4px 8px !important;
    text-transform: uppercase !important;
}
form.tormenta20.tabbed .item-list .item-header > div,
form.tormenta20.tabbed ol.item-list .item-header > div {
    color: #c9a76a !important;
}
form.tormenta20.tabbed .item-list .item,
form.tormenta20.tabbed ol.item-list .item {
    border-bottom: 1px solid rgba(201, 167, 106, 0.06) !important;
    padding: 3px 8px !important;
    align-items: center !important;
    color: #b8ad9a !important;
}
form.tormenta20.tabbed .item-list .item:not(.item-header):hover,
form.tormenta20.tabbed ol.item-list .item:not(.item-header):hover {
    background: rgba(201, 167, 106, 0.06) !important;
}
form.tormenta20.tabbed .item-list .item .item-name label,
form.tormenta20.tabbed ol.item-list .item .item-name label {
    color: #b8ad9a !important;
    font-size: 0.8rem !important;
}
form.tormenta20.tabbed .item-list .item .item-name.rollable:hover label,
form.tormenta20.tabbed ol.item-list .item .item-name.rollable:hover label {
    color: #c9a76a !important;
    cursor: pointer !important;
}
form.tormenta20.tabbed .item-list .item .item-image,
form.tormenta20.tabbed ol.item-list .item .item-image {
    border: 1px solid rgba(201, 167, 106, 0.25) !important;
    border-radius: 2px !important;
    flex-shrink: 0 !important;
    background-size: cover !important;
}
form.tormenta20.tabbed .item-list .item .item-rolls,
form.tormenta20.tabbed .item-list .item .item-activation,
form.tormenta20.tabbed .item-list .item .item-type,
form.tormenta20.tabbed ol.item-list .item .item-rolls,
form.tormenta20.tabbed ol.item-list .item .item-activation,
form.tormenta20.tabbed ol.item-list .item .item-type {
    color: #6a5e48 !important;
    font-size: 0.72rem !important;
}
form.tormenta20.tabbed .item-list .item .item-qty,
form.tormenta20.tabbed .item-list .item .item-weight,
form.tormenta20.tabbed .item-list .item .item-def,
form.tormenta20.tabbed ol.item-list .item .item-qty,
form.tormenta20.tabbed ol.item-list .item .item-weight,
form.tormenta20.tabbed ol.item-list .item .item-def {
    color: #5a5040 !important;
    font-size: 0.72rem !important;
    text-align: center !important;
}
form.tormenta20.tabbed .item-list .item input[type="text"],
form.tormenta20.tabbed ol.item-list .item input[type="text"] {
    background: transparent !important;
    border: 1px solid rgba(201, 167, 106, 0.18) !important;
    border-radius: 2px !important;
    color: #b8ad9a !important;
    font-size: 0.78rem !important;
    text-align: center !important;
    padding: 1px 2px !important;
}
form.tormenta20.tabbed .item-list .item .item-equipped i,
form.tormenta20.tabbed ol.item-list .item .item-equipped i {
    color: #5a5040 !important;
}
form.tormenta20.tabbed .item-list .item .item-toggles a,
form.tormenta20.tabbed ol.item-list .item .item-toggles a {
    color: #4a3e2a !important;
}
form.tormenta20.tabbed .item-list .item .item-toggles a.active,
form.tormenta20.tabbed ol.item-list .item .item-toggles a.active {
    color: #c9a76a !important;
}

/* Item controls (add / edit / delete) */
form.tormenta20.tabbed .item-controls a,
form.tormenta20.tabbed .item-control {
    color: #4a3e2a !important;
    font-size: 0.72rem !important;
}
form.tormenta20.tabbed .item-controls a:hover,
form.tormenta20.tabbed .item-control:hover {
    color: #c9a76a !important;
}

/* ── Inventory Tab ───────────────────────────────────────────────────────── */
form.tormenta20.tabbed .tab.inventory > header {
    align-items: center !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.18) !important;
    padding-bottom: 6px !important;
    margin-bottom: 6px !important;
}
form.tormenta20.tabbed .tab.inventory .item.button {
    background: rgba(201, 167, 106, 0.1) !important;
    border: 1px solid rgba(201, 167, 106, 0.25) !important;
    border-radius: 3px !important;
    color: #c9a76a !important;
    font-size: 0.7rem !important;
}
form.tormenta20.tabbed .tab.inventory .item.button:hover {
    background: rgba(201, 167, 106, 0.2) !important;
}

/* Currency */
form.tormenta20.tabbed .currency {
    display: flex !important;
    gap: 6px !important;
    align-items: center !important;
    flex: 1 !important;
}
form.tormenta20.tabbed .currency .coin-denomination {
    display: flex !important;
    align-items: center !important;
    gap: 3px !important;
}
form.tormenta20.tabbed .currency label {
    color: #6a5e48 !important;
    font-size: 0.7rem !important;
}
form.tormenta20.tabbed .currency input {
    background: rgba(15, 10, 4, 0.6) !important;
    border: 1px solid rgba(201, 167, 106, 0.2) !important;
    border-radius: 2px !important;
    color: #c0b49a !important;
    font-size: 0.78rem !important;
    text-align: center !important;
    width: 44px !important;
    padding: 1px 2px !important;
    height: auto !important;
}

/* Encumbrance */
form.tormenta20.tabbed .encumbrance {
    margin-top: 8px !important;
    padding: 0 2px !important;
}
form.tormenta20.tabbed .encumbrance-bar {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(201, 167, 106, 0.15) !important;
    border-radius: 2px !important;
    height: 5px !important;
    overflow: hidden !important;
}
form.tormenta20.tabbed .encumbrance-bar .bar {
    background: linear-gradient(90deg, #6a4a18, #c9a76a) !important;
    height: 100% !important;
}
form.tormenta20.tabbed .encumbrance .enc-label,
form.tormenta20.tabbed .encumbrance label {
    color: #5a5040 !important;
    font-size: 0.68rem !important;
}

/* ── Spells Tab ──────────────────────────────────────────────────────────── */
form.tormenta20.tabbed .tab.spells .item-list .item-header:first-child {
    background: rgba(15, 10, 4, 0.6) !important;
    border: none !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.2) !important;
    justify-content: center !important;
    text-align: center !important;
    flex-wrap: wrap !important;
    gap: 4px !important;
}
form.tormenta20.tabbed .tab.spells label {
    color: #8a7e6a !important;
    font-size: 0.78rem !important;
}
form.tormenta20.tabbed .tab.spells .selectAtr,
form.tormenta20.tabbed .tab.spells select.selectAtr {
    background: rgba(15, 10, 4, 0.6) !important;
    border: 1px solid rgba(201, 167, 106, 0.22) !important;
    color: #b8ad9a !important;
    border-radius: 2px !important;
    font-size: 0.74rem !important;
    height: auto !important;
    padding: 1px 4px !important;
}
form.tormenta20.tabbed .tab.spells .update-cd {
    color: #6a5e48 !important;
}
form.tormenta20.tabbed .tab.spells .update-cd:hover {
    color: #c9a76a !important;
}

/* ── Journal Tab ─────────────────────────────────────────────────────────── */
form.tormenta20.tabbed .tab.journal .section-titles,
form.tormenta20.tabbed .tab.journal .section-titles input {
    background: linear-gradient(to right, rgba(201, 167, 106, 0.12), transparent) !important;
    border: none !important;
    border-bottom: 1px solid rgba(201, 167, 106, 0.25) !important;
    color: #c9a76a !important;
    font-family: 'Cinzel', 'Modesto Condensed', serif !important;
    font-size: 0.7rem !important;
    letter-spacing: 0.1em !important;
    margin-bottom: 4px !important;
    padding: 3px 6px !important;
    text-transform: uppercase !important;
    width: 100% !important;
}
form.tormenta20.tabbed .tab.journal article {
    margin-bottom: 10px !important;
}
form.tormenta20.tabbed .tab.journal .editor {
    border: 1px solid rgba(201, 167, 106, 0.15) !important;
    border-radius: 2px !important;
}
form.tormenta20.tabbed .tab.journal .editor-content {
    background: rgba(8, 5, 1, 0.5) !important;
    color: #b8ad9a !important;
    font-family: 'EB Garamond', 'Palatino Linotype', serif !important;
    font-size: 0.82rem !important;
    min-height: 80px !important;
    padding: 6px !important;
}

/* ── Effects Tab ─────────────────────────────────────────────────────────── */
form.tormenta20.tabbed .tab.effects .item-list .item .item-name {
    color: #b8ad9a !important;
}
form.tormenta20.tabbed .tab.effects .item-list .item .item-source {
    color: #6a5e48 !important;
    font-size: 0.72rem !important;
}
form.tormenta20.tabbed .tab.effects .item-list .item .item-duration {
    color: #5a5040 !important;
    font-size: 0.72rem !important;
}

/* ── Modifiers Tab ───────────────────────────────────────────────────────── */
form.tormenta20.tabbed .tab.modifiers {
    color: #b8ad9a !important;
}

/* ── Right column (favorites, resources extra) ───────────────────────────── */
form.tormenta20.tabbed .attributes-right {
    gap: 6px !important;
}
form.tormenta20.tabbed .attributes-right .resource {
    border: 1px solid rgba(201, 167, 106, 0.2) !important;
    border-radius: 3px !important;
    padding: 4px 8px !important;
    background: rgba(15, 10, 4, 0.5) !important;
}

/* ── Global inputs/selects within sheet ──────────────────────────────────── */
form.tormenta20.tabbed select {
    background: rgba(15, 10, 4, 0.7) !important;
    border: 1px solid rgba(201, 167, 106, 0.22) !important;
    color: #b8ad9a !important;
    border-radius: 2px !important;
}
form.tormenta20.tabbed input[type="text"]:focus,
form.tormenta20.tabbed input[type="number"]:focus,
form.tormenta20.tabbed textarea:focus {
    outline: none !important;
    box-shadow: 0 0 0 1px rgba(201, 167, 106, 0.35) !important;
}

/* ── Scrollbar ───────────────────────────────────────────────────────────── */
form.tormenta20.tabbed ::-webkit-scrollbar {
    width: 5px !important;
    height: 5px !important;
}
form.tormenta20.tabbed ::-webkit-scrollbar-track {
    background: #0c0907 !important;
}
form.tormenta20.tabbed ::-webkit-scrollbar-thumb {
    background: rgba(201, 167, 106, 0.28) !important;
    border-radius: 3px !important;
}
form.tormenta20.tabbed ::-webkit-scrollbar-thumb:hover {
    background: rgba(201, 167, 106, 0.5) !important;
}
`;

// ── Vital bar injection ───────────────────────────────────────────────────────

function injectVitalBars(root: HTMLElement): void {
    root.querySelectorAll(".t20-vital-bar").forEach((el) => el.remove());

    const healthEl = root.querySelector<HTMLElement>(".attribute.health");
    if (healthEl) {
        const cur = parseInt(healthEl.querySelector<HTMLInputElement>('input[name*="pv.value"]')?.value ?? "0") || 0;
        const max = Math.max(1, parseInt(healthEl.querySelector<HTMLInputElement>('input[name*="pv.max"]')?.value ?? "1") || 1);
        const pct = Math.min(100, Math.max(0, (cur / max) * 100));
        const bar = document.createElement("div");
        bar.className = "t20-vital-bar t20-vital-bar--hp";
        bar.innerHTML = `<div class="t20-vital-bar__fill" style="width:${pct.toFixed(1)}%"></div>`;
        healthEl.appendChild(bar);
    }

    const manaEl = root.querySelector<HTMLElement>(".attribute.mana");
    if (manaEl) {
        const cur = parseInt(manaEl.querySelector<HTMLInputElement>('input[name*="pm.value"]')?.value ?? "0") || 0;
        const max = Math.max(1, parseInt(manaEl.querySelector<HTMLInputElement>('input[name*="pm.max"]')?.value ?? "1") || 1);
        const pct = Math.min(100, Math.max(0, (cur / max) * 100));
        const bar = document.createElement("div");
        bar.className = "t20-vital-bar t20-vital-bar--pm";
        bar.innerHTML = `<div class="t20-vital-bar__fill" style="width:${pct.toFixed(1)}%"></div>`;
        manaEl.appendChild(bar);
    }
}

// ── Public entry point ────────────────────────────────────────────────────────

export function setupSheetRedesign(): void {
    if (!document.getElementById(SHEET_STYLES_ID)) {
        const el = document.createElement("style");
        el.id = SHEET_STYLES_ID;
        el.textContent = SHEET_STYLES;
        document.head.appendChild(el);
    }

    Hooks.on("renderActorSheet", (...args: unknown[]): void => {
        const htmlArg = args[1] as unknown;
        let root: HTMLElement | undefined;
        if (htmlArg instanceof HTMLElement) {
            root = htmlArg;
        } else if (Array.isArray(htmlArg)) {
            root = htmlArg[0] as HTMLElement | undefined;
        } else if (htmlArg && typeof htmlArg === "object") {
            root = (htmlArg as Record<string, unknown>)[0] as HTMLElement | undefined;
        }
        if (!(root instanceof HTMLElement)) return;
        injectVitalBars(root);
    });

    log("Sheet redesign ativo.");
}
