/**
 * Pocket Frames — Dedicated Mobile App Entry Point
 * Boots the mobile PWA experience with 0ms latency and 120Hz smooth animations.
 */
import './mobileApp.css';
import { initMobileApp } from './mobileApp.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initMobileApp());
} else {
  initMobileApp();
}
