"use client"

import React from 'react';

interface SectionProps {
    children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ children }) => {
    return (
        <section
            className='flex h-full w-full items-center justify-center'
        >
            <div
                className="flex w-[86%] xl:w-[90%] max-w-screen-2xl flex-col gap-6 md:flex-row"
            >
                {children}
            </div>
        </section>
    );
}

export default Section;
