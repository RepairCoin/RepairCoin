'use client';

import React from 'react';
import Section from './Section';

const logo = "/nav-logo.png";

const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 z-20 w-full">
      <nav className="ease-in-ou fixed top-0 left-0 z-20 w-full transition-all duration-300">
        <Section>
          <div className="flex w-full flex-wrap items-center justify-between py-6">
            <div className="flex items-center space-x-26">
              <a
                href="/"
                className="flex items-center space-x-3 rtl:space-x-reverse"
              >
                <img src={logo} alt="" className="w-40" />
              </a>
              <ul className="flex items-center space-x-6">
                <li>
                  <a className='text-white' href="/">Overview</a>
                </li>
                <li>
                  <a className='text-white' href="/about">Features</a>
                </li>
                <li>
                  <a className='text-white' href="/contact">Pricing</a>
                </li>
                <li>
                  <a className='text-white' href="/contact">About</a>
                </li>
              </ul>
            </div>
            <div className="flex items-center space-x-6">
              <ul className="flex items-center space-x-6">
                <li>
                  <a className='text-white' href="/login">Log In</a>
                </li>
                <li>
                  <div className="flex py-2 px-4 border-2 border-white rounded-full">
                    <a className='text-[#FFCC00]' href="/register">Sign Up</a>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </Section>
      </nav>
    </header>
  );
}

export default Header;
