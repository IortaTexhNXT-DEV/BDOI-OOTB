import React from 'react';
import { Carousel } from 'primereact/carousel';
import {data,responsiveOptions} from './mock'

const CarouselComponent = ({showIndicators,showArrows, circular,containerHeights,itemTemplate, vertical }) => {
    
  
    return (
        
            <Carousel
                value={data}
                itemTemplate={itemTemplate}
                orientation={vertical && 'vertical'}
                style={{ height:containerHeights}}
                circular={circular}
                numScroll={1} numVisible={3}
                responsiveOptions={responsiveOptions}
                showNavigators={showArrows}
                showIndicators={showIndicators}
            />
        
    );
};

export default CarouselComponent;
