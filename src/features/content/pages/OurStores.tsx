export default function OurStores() {
  return (
    <div>
      <div className="container s-ourstores-b744a7">
        <h5 className="s-ourstores-ab0dfc">Our Stores</h5>
        <div className="s-ourstores-0e2f63">
          {/* Store Info */}
          <div className="s-blog1-9c9546">
            <div className="s-ourstores-5cd98f">
              <div className="s-cart-1fdbde">
                <div className="s-ourstores-92e67b">
                  <i className="bi bi-shop s-contactus-50f301" />
                </div>
                <h5 className="s-ourstores-79c3a4">TWAM Store, Hyderabad</h5>
              </div>
              <div className="s-ourstores-07187e">
                <i className="bi bi-geo-alt-fill s-ourstores-620c07" />
                <p className="s-ourstores-f5e3d7">GSM Mall, Miyapur Main Rd, ICRISAT Colony, Madeenaguda, Hyderabad, Telangana 500050</p>
              </div>
              <div className="s-ourstores-07187e">
                <i className="bi bi-telephone-fill s-ourstores-f951cf" />
                <a href="tel:+917036534449" className="s-ourstores-53c135">+91 7036534449</a>
              </div>
              <div className="s-ourstores-ac0d93">
                <i className="bi bi-clock-fill s-ourstores-f951cf" />
                <span>Mon–Sat to All Days: 10:00 AM – 9:00 PM</span>
              </div>
              <a href="https://maps.google.com/?q=TWAM+store+Hyderabad" target="_blank" rel="noopener noreferrer"
                className="s-ourstores-bf19d5">
                <i className="bi bi-map" /> Get Directions
              </a>
            </div>
          </div>

          {/* Map */}
          <div className="s-ourstores-5a839d">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3805.237817198014!2d78.33310847414386!3d17.49615739966458!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb9300258c22ed%3A0x13b73f6f50ff06d8!2sTWAM%20store!5e0!3m2!1sen!2sin!4v1749451493523!5m2!1sen!2sin"
              width="100%" height="450" className="s-ourstores-510d87"
              allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              title="TWAM Store Map" />
          </div>
        </div>
      </div>
    </div>
  );
}
